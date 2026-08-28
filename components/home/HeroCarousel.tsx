'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { HeroSlide } from '@/data/homepage'
import { normalizeHeroStyle } from '@/lib/home/hero-style'

function responsiveFontSize(size: number, mobileScale: number) {
  return `clamp(${Math.round(size * mobileScale)}px, ${(size / 12).toFixed(2)}vw, ${size}px)`
}

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
  const style = normalizeHeroStyle(slide.styleConfig)
  return (
    <section
  aria-roledescription="carousel"
  aria-label="Featured products and design services"
  tabIndex={0}
  className="relative h-[clamp(420px,62vw,760px)] w-full overflow-hidden bg-zinc-100 focus:outline-none"
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
      <div className={`pointer-events-none relative z-20 mx-auto flex h-full w-full max-w-[1440px] px-5 py-10 sm:px-8 sm:py-16 lg:px-12 ${slide.verticalAlignment === 'top' ? 'items-start' : slide.verticalAlignment === 'bottom' ? 'items-end' : 'items-center'}`}>
        <div className={`max-w-2xl ${slide.alignment === 'right' ? 'lg:ml-auto' : slide.alignment === 'center' ? 'mx-auto' : ''}`} style={{ textAlign: style.textAlignment }}>
          {slide.eyebrow && <p className="mb-4 inline-flex px-3 py-1 uppercase tracking-[.22em]" style={{ color: style.eyebrowColor, backgroundColor: style.eyebrowBackgroundColor, fontSize: responsiveFontSize(style.eyebrowSize, .85), fontWeight: style.eyebrowWeight, borderRadius: style.eyebrowRadius }}>{slide.eyebrow}</p>}
          {slide.title && <h1 className="leading-[1.02]" style={{ color: style.headingColor, fontSize: responsiveFontSize(style.headingSize, .56), fontWeight: style.headingWeight }}>{slide.title}</h1>}
          {slide.description && <p className={`max-w-xl leading-[1.55] ${slide.title || slide.eyebrow ? 'mt-5' : ''} ${style.textAlignment === 'right' ? 'ml-auto' : style.textAlignment === 'center' ? 'mx-auto' : ''}`} style={{ color: style.descriptionColor, fontSize: responsiveFontSize(style.descriptionSize, .88) }}>{slide.description}</p>}
          {slide.buttonLabel && slide.href && <Link href={slide.href} className={`pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-md px-6 py-3 text-sm font-bold transition hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-4 ${slide.title || slide.description || slide.eyebrow ? 'mt-8' : ''}`} style={{ backgroundColor: style.buttonColor, color: style.buttonTextColor }}>
            {slide.buttonLabel}<ArrowRight className="h-4 w-4" />
          </Link>}
        </div>
      </div>
      {slides.length > 1 && (
        <>
          <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 gap-2 opacity-60 hover:opacity-100">
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
