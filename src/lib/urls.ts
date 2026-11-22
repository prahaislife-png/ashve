export function fileUrl(productId: string, name: string) {
  return `/api/products/${productId}/files/${name}`;
}
