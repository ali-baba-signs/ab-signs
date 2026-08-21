module.exports = [
"[project]/lib/editor/browser-preview.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "renderBrowserSide",
    ()=>renderBrowserSide,
    "uploadBrowserRender",
    ()=>uploadBrowserRender
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$fabric$40$7$2e$4$2e$0$2f$node_modules$2f$fabric$2f$dist$2f$index$2e$min$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/fabric@7.4.0/node_modules/fabric/dist/index.min.mjs [app-ssr] (ecmascript)");
;
function canvasBlob(canvas, contentType, quality) {
    return new Promise((resolve, reject)=>{
        canvas.toBlob((blob)=>blob ? resolve(blob) : reject(new Error('The browser could not encode the design preview.')), contentType, quality);
    });
}
function opaqueCopy(source) {
    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    const context = output.getContext('2d');
    if (!context) throw new Error('The browser could not prepare the production preview.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(source, 0, 0);
    return output;
}
async function renderBrowserSide(canvasJson, productConfig) {
    const width = Math.max(100, Math.round(productConfig.logicalCanvasWidth));
    const height = Math.max(100, Math.round(productConfig.logicalCanvasHeight));
    const element = document.createElement('canvas');
    const canvas = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$fabric$40$7$2e$4$2e$0$2f$node_modules$2f$fabric$2f$dist$2f$index$2e$min$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["StaticCanvas"](element, {
        width,
        height,
        backgroundColor: '#ffffff',
        renderOnAddRemove: false
    });
    try {
        await canvas.loadFromJSON(canvasJson);
        canvas.renderAll();
        const filter = (object)=>!object.excludeFromExport;
        const maxDimension = Math.max(width, height);
        const previewCanvas = canvas.toCanvasElement(Math.min(2, 3200 / maxDimension), {
            filter
        });
        const productionCanvas = canvas.toCanvasElement(Math.min(5, 6500 / maxDimension), {
            filter
        });
        const productionOpaque = opaqueCopy(productionCanvas);
        const [previewBlob, productionBlob] = await Promise.all([
            canvasBlob(previewCanvas, 'image/png'),
            canvasBlob(productionOpaque, 'image/jpeg', 0.94)
        ]);
        return {
            preview: {
                blob: previewBlob,
                contentType: 'image/png',
                pixelWidth: previewCanvas.width,
                pixelHeight: previewCanvas.height
            },
            production: {
                blob: productionBlob,
                contentType: 'image/jpeg',
                pixelWidth: productionOpaque.width,
                pixelHeight: productionOpaque.height
            }
        };
    } finally{
        canvas.dispose();
    }
}
async function uploadBrowserRender(asset, filename, designId) {
    const presignResponse = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            filename,
            contentType: asset.contentType,
            size: asset.blob.size,
            purpose: 'design-preview',
            designId
        })
    });
    const presignPayload = await presignResponse.json();
    if (!presignResponse.ok) throw new Error(presignPayload.error?.message || 'The design preview upload could not be prepared.');
    const uploadResponse = await fetch(presignPayload.data.uploadUrl, {
        method: 'PUT',
        headers: {
            'content-type': asset.contentType
        },
        body: asset.blob
    });
    if (!uploadResponse.ok) throw new Error('The generated design preview could not be uploaded.');
    return {
        key: presignPayload.data.key,
        contentType: asset.contentType,
        size: asset.blob.size,
        pixelWidth: asset.pixelWidth,
        pixelHeight: asset.pixelHeight
    };
}
}),
"[project]/app/canvasfix01-test/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CanvasFixVerificationPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$6_$40$babel$2b$core$40$7$2e$2_40a7effce8bcad24669d45809ebe449e$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.2.6_@babel+core@7.2_40a7effce8bcad24669d45809ebe449e/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$6_$40$babel$2b$core$40$7$2e$2_40a7effce8bcad24669d45809ebe449e$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/next@16.2.6_@babel+core@7.2_40a7effce8bcad24669d45809ebe449e/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$fabric$40$7$2e$4$2e$0$2f$node_modules$2f$fabric$2f$dist$2f$index$2e$min$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/.pnpm/fabric@7.4.0/node_modules/fabric/dist/index.min.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2f$browser$2d$preview$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/editor/browser-preview.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
function CanvasFixVerificationPage() {
    const [result, setResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$6_$40$babel$2b$core$40$7$2e$2_40a7effce8bcad24669d45809ebe449e$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])('RUNNING');
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$6_$40$babel$2b$core$40$7$2e$2_40a7effce8bcad24669d45809ebe449e$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let disposed = false;
        const verify = async ()=>{
            const canvas = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$fabric$40$7$2e$4$2e$0$2f$node_modules$2f$fabric$2f$dist$2f$index$2e$min$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Canvas"](document.createElement('canvas'), {
                width: 400,
                height: 200,
                backgroundColor: '#ffffff'
            });
            try {
                const image = await __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$fabric$40$7$2e$4$2e$0$2f$node_modules$2f$fabric$2f$dist$2f$index$2e$min$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FabricImage"].fromURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
                image.set({
                    left: 55,
                    top: 40,
                    angle: 27,
                    scaleX: 70,
                    scaleY: 90,
                    flipX: true
                });
                canvas.add(image, new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$fabric$40$7$2e$4$2e$0$2f$node_modules$2f$fabric$2f$dist$2f$index$2e$min$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Textbox"]('Canvas preview text', {
                    left: 175,
                    top: 85,
                    width: 180,
                    fontSize: 24,
                    fill: '#ed1b68',
                    angle: -8
                }));
                const rendered = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$editor$2f$browser$2d$preview$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["renderBrowserSide"])(canvas.toJSON(), {
                    widthMm: 1000,
                    heightMm: 500,
                    bleedMm: 3,
                    safeMarginMm: 10,
                    logicalCanvasWidth: 400,
                    logicalCanvasHeight: 200
                });
                const valid = rendered.preview.blob.size > 0 && rendered.production.blob.size > 0 && rendered.preview.pixelWidth === 800 && rendered.preview.pixelHeight === 400 && rendered.production.pixelWidth === 2000 && rendered.production.pixelHeight === 1000;
                if (!disposed) setResult(valid ? 'PASS:image,text,rotation,mirror,scale,dimensions' : 'FAIL:render-output');
            } finally{
                canvas.dispose();
            }
        };
        void verify().catch((error)=>{
            if (!disposed) setResult(`FAIL:${error instanceof Error ? error.message : 'unknown'}`);
        });
        return ()=>{
            disposed = true;
        };
    }, []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f2e$pnpm$2f$next$40$16$2e$2$2e$6_$40$babel$2b$core$40$7$2e$2_40a7effce8bcad24669d45809ebe449e$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("output", {
        id: "canvasfix01-result",
        children: result
    }, void 0, false, {
        fileName: "[project]/app/canvasfix01-test/page.tsx",
        lineNumber: 29,
        columnNumber: 10
    }, this);
}
}),
];

//# sourceMappingURL=_0qed-xo._.js.map