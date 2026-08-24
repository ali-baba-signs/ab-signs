'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HeroSlide } from '@/data/homepage'

export function HeroCarousel({ slides }: { slides: Array<HeroSlide & { image: string; mobileImage: string }> }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      setActive((value) => (value - 1 + slides.length) % slides.length)
    }

    if (event.key === 'ArrowRight') {
      setActive((value) => (value + 1) % slides.length)
    }
  }

  window.addEventListener('keydown', handleKeyDown)

  return () => {
    window.removeEventListener('keydown', handleKeyDown)
  }
}, [slides.length])

  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => setActive((value) => (value + 1) % slides.length), 7000)
    return () => window.clearInterval(timer)
  }, [paused, slides.length])

  const slide = slides[active]
  const move = (direction: number) => setActive((value) => (value + direction + slides.length) % slides.length)

  return (
    <section
  aria-roledescription="carousel"
  aria-label="Featured products and design services"
  tabIndex={0}
  className="relative w-full h-[650px] overflow-hidden bg-[#111] sm:h-[700px] lg:h-[760px] focus:outline-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((item, index) => (
        <div key={item.id} aria-hidden={index !== active} className={`absolute inset-0 transition-opacity duration-700 ${index === active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
          <picture>
            <source media="(max-width: 639px)" srcSet={item.mobileImage} />
            <Image
              src={item.image}
              alt={item.altText}
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover object-center"
              onError={(event) => {
                if (!event.currentTarget.src.endsWith(item.fallbackImage)) {
                  event.currentTarget.src = item.fallbackImage
                }
              }}
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/15" />
        </div>
      ))}
      <div className="absolute inset-0 z-0 flex">
  
  {/* Left click zone */}
  <button
    type="button"
    aria-label="Previous slide"
    className="h-full w-1/2 cursor-w-resize"
    onClick={() =>
      setActive((value) => (value - 1 + slides.length) % slides.length)
    }
  />

  {/* Right click zone */}
  <button
    type="button"
    aria-label="Next slide"
    className="h-full w-1/2 cursor-e-resize"
    onClick={() =>
      setActive((value) => (value + 1) % slides.length)
    }
  />

</div>
      <div className={`relative z-20 flex h-full w-full mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-16 lg:px-12 ${slide.verticalAlignment === 'top' ? 'items-start' : slide.verticalAlignment === 'bottom' ? 'items-end' : 'items-center'}`}>
        <div className={`max-w-2xl text-white ${slide.alignment === 'right' ? 'lg:ml-auto lg:text-right' : slide.alignment === 'center' ? 'mx-auto text-center' : ''}`}>
          {slide.eyebrow && <p className="mb-4 text-xs font-bold uppercase tracking-[.22em] text-[#ff4b91]">{slide.eyebrow}</p>}
          {slide.title && <h1 className="text-4xl font-black leading-[1.02] sm:text-5xl lg:text-7xl">{slide.title}</h1>}
          {slide.description && <p className={`max-w-xl text-base leading-7 text-white/80 sm:text-lg ${slide.title || slide.eyebrow ? 'mt-5' : ''} ${slide.alignment === 'right' ? 'lg:ml-auto' : slide.alignment === 'center' ? 'mx-auto' : ''}`}>{slide.description}</p>}
          {slide.buttonLabel && slide.href && <Link href={slide.href} className={`inline-flex min-h-12 items-center gap-2 rounded-md bg-[#ed1b68] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#c91556] focus-visible:outline-2 focus-visible:outline-offset-4 ${slide.title || slide.description || slide.eyebrow ? 'mt-8' : ''}`}>
            {slide.buttonLabel}<ArrowRight className="h-4 w-4" />
          </Link>}
        </div>
      </div>
      {slides.length > 1 && (
        <>
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 opacity-60 hover:opacity-100">
            {slides.map((item, index) => <button key={item.id} type="button" aria-label={`Show slide ${index + 1}`} aria-current={index === active} onClick={() => setActive(index)} className={`h-2.5 rounded-full transition-all ${index === active ? 'w-8 bg-[#ed1b68]' : 'w-2.5 bg-white/60'}`} />)}
          </div>
          {/* <div className="absolute bottom-4 right-4 flex gap-2 sm:right-8">
            <button type="button" onClick={() => move(-1)} aria-label="Previous slide" className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/30 text-white backdrop-blur hover:bg-black/60"><ArrowLeft /></button>
            <button type="button" onClick={() => move(1)} aria-label="Next slide" className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/30 text-white backdrop-blur hover:bg-black/60"><ArrowRight /></button>
          </div> */}
        </>
      )}
    </section>
  )
}
