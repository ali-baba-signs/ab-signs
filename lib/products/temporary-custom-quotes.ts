// TEMPORARY: Static quote-only products. Remove this file and its two imports
// when these products move to a permanent product system.
export const TEMPORARY_CUSTOM_QUOTE_IMAGE = 'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png'


export const TEMPORARY_CUSTOM_QUOTE_PRODUCTS = [
  { id: 'custom-quote-table-cloths', name: 'Table Cloths',image:'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png',description: 'Custom printed table cloths made for events, displays, and branded spaces.' },
  { id: 'custom-quote-pull-up-banner', name: 'Pull Up Banner',image:'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png', description: 'Portable pull up banners tailored to your artwork and display requirements.' },
  { id: 'custom-quote-shop-front-signs', name: 'Shop Front Signs', image:'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png', description: 'Made-to-measure signage for shop fronts, windows, and business premises.' },
  { id: 'custom-quote-3d-signs', name: '3D Signs', image:'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png', description: 'Dimensional signage produced to your preferred size, material, and finish.' },
  { id: 'custom-quote-grass-stakes', name: 'Grass Stakes', image:'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png', description: 'Custom printed grass stakes for promotions, events, and directional signage.' },
  { id: 'custom-quote-a-frames', name: 'A Frames', image:'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png', description: 'Custom A-frame signage for footpaths, retail spaces, and events.' },
  { id: 'custom-quote-business-cards', name: 'Business Cards', image:'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png', description: 'Business cards prepared to suit your stock, finish, and quantity requirements.' },
  { id: 'custom-quote-flyers', name: 'Flyers', image:'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png', description: 'Custom flyers available in the size, stock, finish, and quantity you need.' },
  { id: 'custom-quote-menus-brochures', name: 'Menus/Brochures', image:'https://assets.alibabasigns.com.au/products/Static%20Products/custom.png', description: 'Menus and brochures tailored to your format, folds, stock, and finish.' },
] as const

export function temporaryCustomQuoteProduct(id: string) {
  return TEMPORARY_CUSTOM_QUOTE_PRODUCTS.find((product) => product.id === id) ?? null
}

export function temporaryCustomQuoteProductByName(name: string) {
  return TEMPORARY_CUSTOM_QUOTE_PRODUCTS.find((product) => product.name.toLowerCase() === name.trim().toLowerCase()) ?? null
}
