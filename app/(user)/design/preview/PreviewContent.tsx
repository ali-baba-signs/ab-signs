"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { CUSTOM_PRODUCT_ID, customArtworkPrice, customDimensions } from "@/lib/products/custom-artwork";
import { PRINT_SETTINGS, millimetres, printGeometry } from "@/lib/production/print-settings";
import { PrintPreparationGuide } from "@/components/products/print-preparation-guide";
type Product = {
  id: string;
  name: string;
  freeShipping?: boolean;
  customShippingAmount?: string | null;
  pricePerSquareMetre?: number;
  sizeMode?: string;
  category?: { category?: string };
  images: Array<{ url: string; isPrimary: boolean }>;
  sizes: Array<{
    id: string;
    label: string;
    width: string | null;
    height: string | null;
    unit: string;
    unitPrice: string;
    enabled: boolean;
    sideMode?: string;
    bleed?: string;
    safeMargin?: string;
    trimMarks?: boolean;
  }>;
  templateSizes?: Product['sizes'];
  templates?: Array<{
    id: string;
    name: string;
    previewImageUrl?: string | null;
  }>;
};
type Artwork = {
  id: string;
  productId: string | null;
  productSizeId: string | null;
  templateSizeId: string | null;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  notes: string | null;
  customWidth: string | null;
  customHeight: string | null;
  customUnit: string | null;
  previewUrl: string | null;
};
export default function PreviewContent() {
  const query = useSearchParams(),
    router = useRouter(),
    { addItem } = useCart();
  const source = query.get("source") === "upload" ? "upload" : "design",
    designId = query.get("designId"),
    artworkId = query.get("artworkId"),
    productId = query.get("productId"),
    sizeId = query.get("sizeId"),
    templateId = query.get("templateId"),
    requestedDesignType = query.get("designType"),
    quantity = Math.max(1, Math.min(1000, Number(query.get("quantity")) || 1)),
    hasPreviewContext = Boolean(
      productId && sizeId && (source === "design" ? designId : artworkId),
    ),
    missingError = hasPreviewContext
      ? ""
      : "Preview details are missing. Return to the previous step and save again.";
  const [product, setProduct] = useState<Product | null>(null),
    [artwork, setArtwork] = useState<Artwork | null>(null),
    [printSettings, setPrintSettings] = useState({ bleed: PRINT_SETTINGS.bleed as number, safeMargin: PRINT_SETTINGS.safeMargin as number, cropMarks: true }),
    [loading, setLoading] = useState(hasPreviewContext),
    [error, setError] = useState(""),
    [continuing, setContinuing] = useState(false),
    [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  useEffect(() => {
    if (!hasPreviewContext) return;
    void (async () => {
      try {
        const requests = [
          fetch(`/api/products/${encodeURIComponent(productId!)}`, {
            cache: "no-store",
          }),
        ];
        if (source === "upload")
          requests.push(
            fetch(`/api/artwork?id=${encodeURIComponent(artworkId!)}`, {
              cache: "no-store",
            }),
          );
        requests.push(fetch('/api/store/settings', { cache: 'no-store' }));
        const responses = await Promise.all(requests),
          payloads = await Promise.all(
            responses.map((response) => response.json()),
          );
        if (!responses[0].ok)
          throw new Error(
            payloads[0].error?.message ||
              "The selected product is unavailable.",
          );
        setProduct(payloads[0].data.product);
        const settingsResponse = responses.at(-1);
        const settingsPayload = payloads.at(-1);
        if (settingsResponse?.ok && settingsPayload?.data) setPrintSettings({ bleed: Number(settingsPayload.data.printBleedMm ?? PRINT_SETTINGS.bleed), safeMargin: Number(settingsPayload.data.printSafeMarginMm ?? PRINT_SETTINGS.safeMargin), cropMarks: settingsPayload.data.printCropMarks !== false });
        if (source === "upload") {
          if (!responses[1].ok)
            throw new Error(
              payloads[1].error?.message ||
                "The uploaded artwork is unavailable.",
            );
          setArtwork(payloads[1].data.artwork);
        }
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "The preview could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [artworkId, hasPreviewContext, productId, source]);
  const size = useMemo<Product['sizes'][number] | null>(() => {
    if (!product) return null;
    const selected = (product.sizeMode === 'template_sizes' ? product.templateSizes || [] : product.sizes).find((item) => item.id === sizeId && item.enabled);
    try {
      if (product.id === CUSTOM_PRODUCT_ID) {
        if (sizeId !== 'custom' || artwork?.productId !== null || !artwork?.customWidth || !artwork.customHeight || !artwork.customUnit || !product.pricePerSquareMetre) return null;
        const unitPrice = customArtworkPrice(artwork.customWidth, artwork.customHeight, artwork.customUnit, product.pricePerSquareMetre);
        if (unitPrice <= 0) return null;
        return { id: 'custom', label: `${artwork.customWidth} × ${artwork.customHeight} ${artwork.customUnit}`, width: artwork.customWidth, height: artwork.customHeight, unit: artwork.customUnit, unitPrice: unitPrice.toFixed(2), enabled: true };
      }
      if (!selected) return null;
      if (source === 'upload' && (!artwork || artwork.productId !== product.id || (artwork.productSizeId !== selected.id && artwork.templateSizeId !== selected.id))) return null;
      if (!artwork?.customWidth || !artwork.customHeight || !artwork.customUnit) return selected;
      const selectedArea = customDimensions(selected.width, selected.height, selected.unit).areaM2;
      const requestedArea = customDimensions(artwork.customWidth, artwork.customHeight, artwork.customUnit).areaM2;
      return { ...selected, label: `${artwork.customWidth} × ${artwork.customHeight} ${artwork.customUnit}`, width: artwork.customWidth, height: artwork.customHeight, unit: artwork.customUnit, unitPrice: (Math.round(Number(selected.unitPrice) * requestedArea / selectedArea * 100) / 100).toFixed(2) };
    } catch {
      return null;
    }
  }, [product, sizeId, artwork, source]);
  const layout = useMemo(() => {
    if (!size?.width || !size.height) return null;
    try {
      const widthMm = millimetres(size.width, size.unit);
      const heightMm = millimetres(size.height, size.unit);
      const custom = product?.id === CUSTOM_PRODUCT_ID;
      const bleedMm = Number(custom ? printSettings.bleed : size.bleed ?? printSettings.bleed);
      const safeMarginMm = Number(custom ? printSettings.safeMargin : size.safeMargin ?? printSettings.safeMargin);
      printGeometry(widthMm, heightMm, bleedMm, safeMarginMm);
      return { widthMm, heightMm, bleedMm, safeMarginMm, cropMarks: custom ? printSettings.cropMarks : size.trimMarks ?? printSettings.cropMarks };
    } catch { return null; }
  }, [size, product, printSettings]);
  if (loading)
    return (
      <main className="grid min-h-[60vh] place-items-center p-6">
        Loading your saved artwork…
      </main>
    );
  if (missingError || error || !product || !size || !layout)
    return (
      <main className="grid min-h-[60vh] place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">Preview Unavailable</h1>
          <p role="alert" className="mt-2 text-red-700">
            {missingError || error || "The selected print size or guide settings are invalid."}
          </p>
          <Link href={source === "upload" ? "/upload-artwork" : "/design"}>
            <Button className="mt-5" variant="outline">
              Return and try again
            </Button>
          </Link>
        </div>
      </main>
    );
  const designType =
      requestedDesignType === "double_side"
        ? "double_side"
        : requestedDesignType === "single_side"
          ? "single_side"
          : size.sideMode === "double"
            ? "double_side"
            : "single_side",
    previewUrl =
      source === "design"
        ? `/api/designs/${encodeURIComponent(designId!)}/preview?side=${previewSide}`
        : artwork?.previewUrl;
  function continueToCheckout() {
    if (continuing || !layout) return;
    setContinuing(true);
    const productImage = (
      product!.images.find((item) => item.isPrimary) || product!.images[0]
    )?.url;
    addItem({
      productId: product!.id,
      productName: product!.name,
      sizeId: size!.id,
      sizeLabel: size!.label,
      templateId: source === "design" ? templateId : null,
      templateName: null,
      designId: source === "design" ? designId : null,
      customizationRef: source === "design" ? designId : null,
      artworkId: source === "upload" ? artworkId : null,
      designSource: source === "design" ? "online_editor" : "customer_upload",
      quantity,
      price: Number(size!.unitPrice),
      image:
        source === "design"
          ? `/api/designs/${encodeURIComponent(designId!)}/preview?side=front`
          : previewUrl || productImage,
      specifications: {
        width: String(size!.width || ""),
        height: String(size!.height || ""),
        unit: size!.unit,
        sideMode: designType === "double_side" ? "double" : "single",
        designType,
        designMode: designType,
        freeShipping: String(Boolean(product!.freeShipping)),
        customShippingAmount: product!.customShippingAmount || "",
        shippingCategory: product!.category?.category || "",
        previewContentType:
          source === "upload" ? artwork?.contentType || "" : "image/png",
        productionNotes: artwork?.notes || "",
        bleedMm: String(layout.bleedMm),
        safeMarginMm: String(layout.safeMarginMm),
        cropMarks: String(layout.cropMarks),
        ...(artwork?.customWidth && artwork.customHeight && artwork.customUnit ? { customWidth: artwork.customWidth, customHeight: artwork.customHeight, customUnit: artwork.customUnit } : {}),
      },
    });
    router.push("/checkout");
  }
  const editUrl = `/design?${new URLSearchParams({ productId: product.id, sizeId: size.id, designType, ...(templateId ? { templateId } : {}) })}`;
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-sm font-bold uppercase tracking-wide text-primary">
        Final artwork check
      </p>
      <h1 className="mt-1 text-3xl font-black">
        Preview Your {source === "upload" ? "Uploaded Artwork" : "Design"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Confirm the customer artwork, product, and production size before
        checkout.
      </p>
      {source === "design" && designType === "double_side" && (
        <div className="mt-5 inline-flex rounded-md border bg-card p-1">
          <button
            type="button"
            onClick={() => setPreviewSide("front")}
            className={`rounded px-4 py-2 text-sm font-bold ${previewSide === "front" ? "bg-primary text-primary-foreground" : ""}`}
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => setPreviewSide("back")}
            className={`rounded px-4 py-2 text-sm font-bold ${previewSide === "back" ? "bg-primary text-primary-foreground" : ""}`}
          >
            Back
          </button>
        </div>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="rounded-xl border bg-card p-5">
          {previewUrl ? (
            artwork?.contentType === "application/pdf" ? (
              <object
                data={`${previewUrl}#page=1&view=FitH`}
                type="application/pdf"
                aria-label="Uploaded PDF artwork preview"
                className="h-[60vh] w-full rounded border bg-white"
              >
                <p>PDF preview is unavailable in this browser.</p>
              </object>
            ) : (
              <img
                key={previewUrl}
                src={previewUrl}
                alt={`${previewSide} customer artwork preview`}
                className="mx-auto max-h-[65vh] max-w-full rounded border bg-white object-contain"
              />
            )
          ) : (
            <div className="grid min-h-80 place-items-center rounded border border-dashed p-8 text-center">
              <div>
                <p className="font-bold">{artwork?.originalFilename}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  This production format is preserved for printing but cannot be
                  rendered safely in the browser.
                </p>
              </div>
            </div>
          )}
        </section>
        <aside className="h-fit rounded-xl border bg-card p-5">
          <h2 className="text-lg font-bold">Product Selection</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Product</dt>
              <dd className="font-semibold">{product.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Size</dt>
              <dd className="font-semibold">
                {size.width && size.height ? (
                    <>
                    {size.width} × {size.height} {size.unit} (
                    {Number(size.width) > Number(size.height)
                        ? "Landscape"
                        : Number(size.width) < Number(size.height)
                        ? "Portrait"
                        : "Square"}
                    )
                    </>
                ) : null}
                </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Design Option</dt>
              <dd className="font-semibold">
                {designType === "double_side" ? "Double Sided" : "Single Sided"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Quantity</dt>
              <dd className="font-semibold">{quantity}</dd>
            </div>
            {artwork && (
              <div>
                <dt className="text-muted-foreground">File</dt>
                <dd className="break-all font-semibold">
                  {artwork.originalFilename}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-5"><PrintPreparationGuide {...layout} /></div>
          <Button
            className="mt-6 w-full"
            size="lg"
            disabled={continuing}
            onClick={continueToCheckout}
          >
            {continuing
              ? "Opening checkout…"
              : "Confirm & continue to checkout"}
          </Button>
          {source === "design" ? (
            <Link href={editUrl}>
              <Button className="mt-3 w-full" variant="outline">
                Edit Design
              </Button>
            </Link>
          ) : (
            <Link href="/upload-artwork">
              <Button className="mt-3 w-full" variant="outline">
                Replace Upload
              </Button>
            </Link>
          )}
        </aside>
      </div>
    </main>
  );
}
