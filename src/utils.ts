import { Product, ProductVariant } from './types';

export const getProductId = (prod: any): any => {
  if (!prod) return null;
  if (prod.id !== undefined && prod.id !== null) return prod.id;
  if (prod.id_produk !== undefined && prod.id_produk !== null) return prod.id_produk;
  if (prod.product_id !== undefined && prod.product_id !== null) return prod.product_id;
  return null;
};

export const getVariantProductId = (v: any): any => {
  if (!v) return null;
  if (v.product_id !== undefined && v.product_id !== null) return v.product_id;
  if (v.id_produk !== undefined && v.id_produk !== null) return v.id_produk;
  if (v.productId !== undefined && v.productId !== null) return v.productId;
  return null;
};

export const isVariantOfProduct = (v: any, prod: any): boolean => {
  const pId = getProductId(prod);
  const vpId = getVariantProductId(v);
  if (pId === null || pId === undefined || vpId === null || vpId === undefined) return false;
  return String(vpId) === String(pId);
};
