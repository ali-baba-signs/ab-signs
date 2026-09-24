"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  enabledDesignConfigurations,
  type DesignType,
  type SizeDesignConfiguration,
} from "@/lib/products/design-configurations";
import { PRINT_SETTINGS } from "@/lib/production/print-settings";

type Size = {
  id: string;
  label: string;
  width: string | null;
  height: string | null;
  unit: string;
  unitPrice: string;
  enabled: boolean;
  sideMode?: string;
  frontTemplateId?: string | null;
  backTemplateId?: string | null;
  designConfigurations?: SizeDesignConfiguration[];
  allowCustomSize?: boolean;
};

type Product = {
  id: string;
  name: string;
  active: boolean;
  sizeMode?: string;
  sizes: Size[];
  templateSizes?: Size[];
  allowCustomDimensions?: boolean;
};

function availableSizes(product: Product | null | undefined) {
  return product?.sizeMode === 'template_sizes' ? product.templateSizes || [] : product?.sizes || [];
}

const accepted =
  ".pdf,.svg,.eps,.ai,.png,application/pdf,image/png,image/svg+xml,application/postscript,application/vnd.adobe.illustrator";

const formatError =
  "Unsupported file type. Please upload only supported formats: PDF, SVG, EPS, AI, PNG.";

export default function UploadArtworkPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [designType, setDesignType] = useState<DesignType>("single_side");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [printSettings, setPrintSettings] = useState({ bleed: PRINT_SETTINGS.bleed as number, safeMargin: PRINT_SETTINGS.safeMargin as number });
  const [customArtworkConfigured, setCustomArtworkConfigured] = useState(false);

  // Custom size state
  const [isCustomSize, setIsCustomSize] = useState(false);
  const [customWidth, setCustomWidth] = useState<number | "">("");
  const [customHeight, setCustomHeight] = useState<number | "">("");
  const [customUnit, setCustomUnit] = useState<string>("mm");

  const isCustomProduct = productId === "custom_product";

  const product = useMemo(() => {
    if (isCustomProduct) {
      return {
        id: "custom_product",
        name: "Custom Product",
        active: true,
        sizes: [],
        allowCustomDimensions: true,
      };
    }
    return products.find((item) => item.id === productId) || null;
  }, [products, productId, isCustomProduct]);

  const sizes = useMemo(
    () => availableSizes(product).filter((item) => item.enabled),
    [product]
  );

  const allowsCustomSize = Boolean(isCustomProduct || (product?.allowCustomDimensions && product.sizeMode !== 'template_sizes'));

  const selectedSize = useMemo(() => {
    if (isCustomSize) {
      const reference = sizes.find((item) => item.id === sizeId);
      return {
        ...reference,
        id: isCustomProduct ? "custom" : sizeId,
        label: "Custom Size",
        width: customWidth !== "" ? String(customWidth) : null,
        height: customHeight !== "" ? String(customHeight) : null,
        unit: customUnit,
        unitPrice: reference?.unitPrice || "0",
        enabled: true,
      } as Size;
    }
    return sizes.find((item) => item.id === sizeId) || null;
  }, [isCustomSize, isCustomProduct, customWidth, customHeight, customUnit, sizes, sizeId]);

  const designOptions = useMemo(() => {
    if (!selectedSize || isCustomProduct) return [];
    return enabledDesignConfigurations(selectedSize);
  }, [selectedSize, isCustomProduct]);

  function applySize(size?: Partial<Size> | null) {
    const nextId = size?.id || "";
    setSizeId(nextId);

    const availableConfigs = size
      ? enabledDesignConfigurations(size as Size)
      : [];
    setDesignType(availableConfigs[0]?.designType || "single_side");
  }

  function handleProductChange(selectedId: string) {
    setProductId(selectedId);

    if (selectedId === "custom_product") {
      setIsCustomSize(true);
      setSizeId("custom");
      setDesignType("single_side");
      return;
    }

    setIsCustomSize(false);
    const next = products.find((item) => item.id === selectedId);
    applySize(availableSizes(next).find((size) => size.enabled));
  }

  function handleSizeChange(selectedId: string) {
    if (selectedId === "custom") {
      setIsCustomSize(true);
      setSizeId(sizes[0]?.id || "");
    } else {
      setIsCustomSize(false);
      const found = sizes.find((s) => s.id === selectedId);
      applySize(found);
    }
  }

  useEffect(() => {
    void fetch("/api/products?limit=100", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(
            payload.error?.message || "Products could not be loaded."
          );
        }
        const active = (payload.data.products || []).filter(
          (item: Product) =>
            item.active !== false && availableSizes(item).some((size) => size.enabled)
        );
        setProducts(active);
        if (active[0]) {
          setProductId(active[0].id);
          applySize(availableSizes(active[0]).find((size: Size) => size.enabled));
        }
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Products could not be loaded."
        )
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    void fetch('/api/store/settings', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((payload) => {
      if (payload?.data) {
        setPrintSettings({ bleed: Number(payload.data.printBleedMm ?? PRINT_SETTINGS.bleed), safeMargin: Number(payload.data.printSafeMarginMm ?? PRINT_SETTINGS.safeMargin) });
        setCustomArtworkConfigured(payload.data.customArtworkConfigured === true);
      }
    }).catch(() => undefined);
  }, []);

  function selectFile(next?: File) {
    if (!next) return;

    const extension = next.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "svg", "eps", "ai", "png"].includes(extension || "")) {
      setFile(null);
      setError(formatError);
      return;
    }
    if (!next.size || next.size > 100 * 1024 * 1024) {
      setFile(null);
      setError("Artwork must be between 1 byte and 100 MB.");
      return;
    }
    setError("");
    setFile(next);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (processing) return;
    if (!product || !sizeId) {
      return setError("Choose an active product and size.");
    }
    if (
      isCustomSize &&
      (typeof customWidth !== "number" ||
        typeof customHeight !== "number" ||
        customWidth <= 0 ||
        customHeight <= 0)
    ) {
      return setError("Please provide valid, positive custom width and height.");
    }
    if (
      designOptions.length > 0 &&
      !designOptions.some((option) => option.designType === designType)
    ) {
      return setError("Choose an available design option.");
    }
    if (!file) return setError("Choose a print-ready artwork file.");

    setProcessing(true);
    setError("");

    try {
      const form = new FormData();
      form.set("file", file);
      form.set("productId", product.id);
      form.set("sizeId", sizeId);
      form.set("notes", notes);
      form.set("orientation", "unspecified");
      form.set("quantityReference", String(quantity));

      if (isCustomProduct) {
        form.set("isCustomProduct", "true");
      }

      if (isCustomSize) {
        form.set("customWidth", String(customWidth));
        form.set("customHeight", String(customHeight));
        form.set("customUnit", customUnit);
      }

      const response = await fetch("/api/artwork", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message || "Artwork upload failed.");
      }

      const params = new URLSearchParams({
        source: "upload",
        artworkId: payload.data.artwork.id,
        productId: product.id,
        sizeId,
        designType,
        quantity: String(quantity),
      });

      if (isCustomProduct) {
        params.set("isCustomProduct", "true");
      }

      if (isCustomSize) {
        params.set("isCustomSize", "true");
        params.set("width", String(customWidth));
        params.set("height", String(customHeight));
        params.set("unit", customUnit);
      }

      router.push(`/design/preview?${params}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Artwork upload failed. Please retry."
      );
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-[70vh] place-items-center">
        Loading active products…
      </main>
    );
  }

  return (
    <main className="min-h-[75vh] bg-zinc-50 px-4 py-12">
      <form
        onSubmit={submit}
        className="mx-auto max-w-2xl rounded-2xl border bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex items-start gap-3">
          <FileUp className="mt-1 h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-black">Upload Artwork</h1>
            <p className="mt-1 text-muted-foreground">
              Upload a finished print file, review it, then continue directly to
              checkout.
            </p>
          </div>
        </div>

        <section className="mt-5 rounded-lg border bg-zinc-50 p-4 text-sm" aria-label="Artwork preparation guide">
          <h2 className="font-bold">Artwork Preparation Guide</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>The selected size is the finished trim size. Extend background artwork beyond its edges.</li>
            <li>Include {printSettings.bleed} mm bleed on every side.</li>
            <li>Keep important text and logos at least {printSettings.safeMargin} mm inside the trim.</li>
            <li>Production crop marks are generated outside the bleed. Do not add cut lines or marks to your artwork.</li>
          </ul>
        </section>

        {error && (
          <p
            role="alert"
            className="mt-5 rounded bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          {/* Product Type Select */}
          <label className="text-sm font-semibold sm:col-span-2">
            Product type
            <select
              required
              className="mt-2 h-11 w-full rounded border bg-background px-3"
              value={productId}
              onChange={(event) => handleProductChange(event.target.value)}
            >
              <option value="">Choose an active product</option>
              <option value="custom_product" disabled={!customArtworkConfigured}>Custom Product{customArtworkConfigured ? '' : ' (unavailable)'}</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          {/* Product Size Select */}
          <label className="text-sm font-semibold sm:col-span-2">
            Product size
            <select
              required
              disabled={isCustomProduct}
              className="mt-2 h-11 w-full rounded border bg-background px-3 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-muted-foreground"
              value={isCustomSize ? "custom" : sizeId}
              onChange={(e) => handleSizeChange(e.target.value)}
            >
              {isCustomProduct ? (
                <option value="custom">Custom size (enter dimensions below)</option>
              ) : (
                <>
                  <option value="">Choose an active size</option>
                  {allowsCustomSize && <option value="custom">Custom size...</option>}
                  {sizes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label ||
                        `${item.width} × ${item.height} ${item.unit || ""}`}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>

          {/* Custom Dimension Fields */}
          {isCustomSize && (
            <div className="rounded-lg border bg-zinc-50 p-4 sm:col-span-2">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Custom Dimensions
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold">Width</label>
                  <Input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    placeholder="Width"
                    className="mt-1 bg-white"
                    value={customWidth}
                    onChange={(e) =>
                      setCustomWidth(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold">Height</label>
                  <Input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    placeholder="Height"
                    className="mt-1 bg-white"
                    value={customHeight}
                    onChange={(e) =>
                      setCustomHeight(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold">Unit</label>
                  <select
                    className="mt-1 h-10 w-full rounded border bg-white px-2 text-sm"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                  >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="in">in</option>
                    <option value="ft">ft</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Design Option */}
          <label className="text-sm font-semibold">
            Design option
            <select
              required
              className="mt-2 h-11 w-full rounded border bg-background px-3"
              value={designType}
              onChange={(event) =>
                setDesignType(event.target.value as DesignType)
              }
            >
              {designOptions.length > 0 ? (
                designOptions.map((option) => (
                  <option key={option.designType} value={option.designType}>
                    {option.designType === "double_side"
                      ? "Double Sided"
                      : "Single Sided"}
                  </option>
                ))
              ) : (
                <>
                  <option value="single_side">Single Sided</option>
                  <option value="double_side">Double Sided</option>
                </>
              )}
            </select>
          </label>

          {/* Quantity */}
          <label className="text-sm font-semibold">
            Quantity
            <Input
              required
              className="mt-2"
              type="number"
              min="1"
              max="1000"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Math.max(1, Math.min(1000, Number(event.target.value) || 1))
                )
              }
            />
          </label>

          {/* Production Notes */}
          <label className="text-sm font-semibold sm:col-span-2">
            Production notes{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
            <textarea
              className="mt-2 min-h-28 w-full rounded border p-3"
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {/* File Upload Box */}
          <label className="cursor-pointer rounded-xl border-2 border-dashed border-primary bg-primary/5 p-7 text-center text-base font-black shadow-sm sm:col-span-2">
            <FileUp className="mx-auto mb-3 h-8 w-8 text-primary" />
            Choose PDF, SVG, EPS, AI, or PNG
            <Input
              className="sr-only"
              type="file"
              accept={accepted}
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
            <span className="mt-2 block text-sm font-semibold text-muted-foreground">
              Accepted: PDF · SVG · EPS · AI · PNG · maximum 100 MB
            </span>
            {file && (
              <span className="mt-3 block break-all rounded bg-green-50 p-2 font-semibold text-green-800">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
          </label>
        </div>

        <Button
          type="submit"
          size="lg"
          className="mt-7 w-full"
          disabled={
            processing ||
            !productId ||
            !sizeId ||
            !file ||
            (isCustomSize && (!customWidth || !customHeight))
          }
        >
          {processing ? "Uploading artwork…" : "Confirm upload & preview"}
        </Button>
      </form>

      {processing && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-white/55 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-4 shadow-xl">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-primary" />
            <p className="font-semibold">Uploading your artwork…</p>
          </div>
        </div>
      )}
    </main>
  );
}
