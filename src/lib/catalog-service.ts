import { ParentProduct } from "../types.ts";

const PRODUCTS_KEY = "suitpro_products";
const CATALOG_UPDATED_EVENT = "suitpro:catalog-updated";

function isCatalog(value: unknown): value is ParentProduct[] {
  return Array.isArray(value) && value.every((product) => product && typeof product === "object" && typeof product.id === "string" && Array.isArray(product.variations));
}

export function publishCatalog(products: ParentProduct[]): ParentProduct[] {
  const snapshot = products.map((product) => ({
    ...product,
    variations: product.variations.map((variation) => ({ ...variation, attributeValues: { ...variation.attributeValues } }))
  }));
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(snapshot));
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CATALOG_UPDATED_EVENT, { detail: snapshot }));
  }
  return snapshot;
}

export async function refreshCatalogFromServer(): Promise<ParentProduct[]> {
  const response = await fetch("/api/products", { cache: "no-store" });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isCatalog(payload)) {
    throw new Error("Catalog server returned an invalid product response.");
  }
  return publishCatalog(payload);
}

export const catalogUpdatedEvent = CATALOG_UPDATED_EVENT;