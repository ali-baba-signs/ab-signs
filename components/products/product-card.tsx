'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Star } from 'lucide-react'

interface ProductCardProps {
  id: string
  name: string
  description?: string
  basePrice: string
  image?: string
  featured?: boolean
  averageRating?: number
  reviewCount?: number
  soldQuantity?: number
}

export function ProductCard({
  id,
  name,
  description,
  basePrice,
  image,
  featured,
  averageRating = 0,
  reviewCount = 0,
  soldQuantity = 0,
}: ProductCardProps) {
  return (
    <div className="group">
      <Link href={`/products/${id}`}>
        <div className="relative h-64 rounded-lg overflow-hidden mb-4 bg-secondary border border-border group-hover:border-primary transition-all">
          {image ? (
            <img
              src={image}
              alt={name}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {featured && (
            <div className="absolute top-3 right-3 bg-primary text-white text-xs font-bold px-2 py-1 rounded">
              Featured
            </div>
          )}
        </div>
      </Link>
      <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
        <Link href={`/products/${id}`} className="hover:underline">{name}</Link>
      </h3>
      {description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>}
      <div className="flex items-center justify-between mt-4 grid grid-cols-2 gap-2">
        <span className="text-lg font-bold text-primary ">${basePrice}</span>
        <Link href={`/products/${id}`}><Button size="sm" className="w-full bg-primary hover:bg-opacity-90 text-white">Choose options</Button></Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground" aria-label="Product popularity">
        <span className="inline-flex items-center gap-1 font-semibold text-foreground"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{reviewCount ? averageRating.toFixed(1) : 'New'}</span>
        <span>{reviewCount} review{reviewCount === 1 ? '' : 's'}</span>
        <span>{soldQuantity >= 500 ? `${Math.floor(soldQuantity / 100) * 100}+` : soldQuantity} sold</span>
      </div>
    </div>
  )
}
