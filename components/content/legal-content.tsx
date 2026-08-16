import { ContentPage, ContentSection } from '@/components/content/content-page'

type Section = { title: string; paragraphs?: string[]; items?: string[] }

function PolicyContent({ title, intro, sections }: { title: string; intro: string; sections: Section[] }) {
  return <ContentPage eyebrow="Legal" title={title} intro={intro}>
    <p className="mb-8 text-sm font-semibold text-muted-foreground">Last Updated: August, 2026 · Version 2026-08</p>
    {sections.map((section) => <ContentSection key={section.title} title={section.title}>
      {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {section.items && <ul className="list-disc space-y-2 pl-6">{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
    </ContentSection>)}
  </ContentPage>
}

const contact = { title: 'Contact Us', items: ['Ali Baba Signs', 'Perth, Western Australia', 'Email: sales@alibabasigns.com.au', 'Phone: 04 33 88 55 79', 'Website: www.alibabasigns.com.au'] }

export function AboutContent() {
  return <ContentPage eyebrow="Company" title="About Us – Ali Baba Signs" intro="Ali Baba Signs is a proudly Australian, family-owned small signage and printing business established in 2019.">
    <ContentSection title="Our Story"><p>From day one, our mission has been simple: deliver high-quality flags and banners at prices local businesses can actually afford. What started as a small family venture has grown into a trusted name across Perth, Western Australia, Australia known for reliable service, durable products, and genuine care for every customer.</p></ContentSection>
    <ContentSection title="Our Specialty: Flags, Banners, Mesh Banners and Signage"><p>We’ve built our reputation on producing standout promotional materials that help businesses get noticed. Whether you’re promoting an event, upgrading your shopfront, or boosting brand visibility, our products are designed to perform.</p><h3 className="mt-4 font-bold">Custom Flags</h3><p>Vibrant colours, premium fabrics, and strong stitching — our flags are made to withstand Australian conditions while showcasing your brand with clarity and impact.</p><h3 className="mt-4 font-bold">Vinyl Banners</h3><p>Perfect for events, storefronts, and promotions. We use high-resolution printing and durable materials to ensure your banner looks sharp and lasts longer.</p><h3 className="mt-4 font-bold">Mesh Banners</h3><p>Ideal for fences, construction sites, and windy outdoor areas. Our mesh banners offer excellent airflow, strong visibility, and long-lasting quality.</p></ContentSection>
    <ContentSection title="Why We Focus on These Products"><p>Flags and banners are some of the most effective and affordable ways for businesses to advertise. As a family business ourselves, we understand the importance of cost-effective marketing — so we’ve dedicated our craft to producing signage that delivers maximum impact without the premium price tag.</p></ContentSection>
    <ContentSection title="Our Values"><h3 className="font-bold">Quality You Can See</h3><p>Every flag and banner is printed with precision using professional-grade materials and modern equipment.</p><h3 className="mt-4 font-bold">Affordable Pricing</h3><p>We believe great signage shouldn’t be expensive. Our pricing is transparent, fair, and designed for small businesses.</p><h3 className="mt-4 font-bold">Family-Owned Service</h3><p>We treat every customer with honesty, respect, and genuine care — the same values our business was built on.</p><h3 className="mt-4 font-bold">Local Expertise</h3><p>Based in Perth, we understand the climate, the community, and the needs of Australian businesses.</p></ContentSection>
    <ContentSection title="Our Mission"><p>To help businesses stand out with high-quality flags, banners, and mesh banners that are durable, affordable, and visually powerful.</p></ContentSection>
    <ContentSection title="Your Brand, Our Craft"><p>Whether you need a single banner or a full set of promotional flags, Ali Baba Signs is here to bring your vision to life with quality workmanship and friendly service.</p></ContentSection>
  </ContentPage>
}

export function PrivacyContent() { return <PolicyContent title="Privacy Policy" intro="Ali Baba Signs (“we”, “our”, “us”) is a family-owned signage and printing business based in Perth, Western Australia. We are committed to protecting your privacy and handling your personal information responsibly, in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs)." sections={[
  { title: 'Introduction', paragraphs: ['This Privacy Policy explains how we collect, use, store, and disclose your personal information when you interact with our website, purchase our products, or communicate with us.'] },
  { title: '1. What Personal Information We Collect', paragraphs: ['We may collect the following types of personal information:'], items: ['Contact details – name, email address, phone number, business name', 'Order information – product details, artwork files, delivery address', 'Payment information – billing details (processed securely through third-party payment providers; we do not store credit card numbers)', 'Website usage data – IP address, browser type, pages visited, cookies', 'Communication records – emails, messages, enquiries, quotes', 'We only collect information that is reasonably necessary for us to provide our services.'] },
  { title: '2. How We Collect Personal Information', items: ['When you place an order or request a quote', 'When you contact us by phone, email, or through our website', 'When you upload artwork or design files', 'When you interact with our website (cookies, analytics tools)', 'When you engage with us on social media'], paragraphs: ['Where reasonable, we collect information directly from you. In some cases, we may receive information from third-party service providers (e.g., payment processors or delivery partners).'] },
  { title: '3. Why We Collect Personal Information', items: ['Processing orders and delivering products', 'Providing quotes, customer support, and service updates', 'Managing payments and invoicing', 'Improving our website, services, and customer experience', 'Marketing, promotions, and communication (only with your consent)', 'Meeting legal and regulatory obligations', 'We do not sell, rent, or trade your personal information.'] },
  { title: '4. Disclosure of Personal Information', items: ['Delivery and courier services', 'Payment processors (e.g., Stripe, PayPal)', 'Printing and production partners (only when required for your order)', 'IT, website hosting, and analytics providers', 'Legal or regulatory authorities, if required by law', 'All third-party providers are required to handle your information securely and in accordance with privacy laws.'] },
  { title: '5. Storage and Security', paragraphs: ['We take reasonable steps to protect your personal information from misuse, loss, unauthorised access, modification, and disclosure.', 'This includes secure servers, encrypted payment gateways, restricted access, and regular system monitoring.', 'However, no online system is completely risk-free, and we cannot guarantee absolute security.'] },
  { title: '6. Cookies and Website Tracking', items: ['Improve website performance', 'Understand visitor behaviour', 'Personalise your experience', 'Assist with marketing and advertising', 'You can disable cookies through your browser settings, although this may affect website functionality.'] },
  { title: '7. Access and Correction', items: ['Request access to the personal information we hold about you', 'Request corrections if your information is inaccurate or outdated', 'To make a request, contact us using the details below. We will respond within a reasonable timeframe.'] },
  { title: '8. Marketing Communications', paragraphs: ['We may send marketing emails or promotions only if you have opted in.', 'You can unsubscribe at any time by clicking the “unsubscribe” link in our emails or contacting us directly.', 'We do not send unsolicited marketing messages.'] },
  { title: '9. Third-Party Links', paragraphs: ['Our website may contain links to external websites.', 'We are not responsible for the privacy practices of third-party sites.', 'We encourage you to review their privacy policies before providing personal information.'] },
  { title: '10. Changes to This Privacy Policy', paragraphs: ['We may update this Privacy Policy from time to time to reflect changes in our business or legal requirements.'] },
  { ...contact, title: '11. Contact Us' },
]} /> }

export function TermsContent() { return <PolicyContent title="Terms & Conditions" intro="These Terms & Conditions (“Terms”) govern your use of the Ali Baba Signs website and services. By accessing our website, placing an order, or engaging our services, you agree to these Terms. Ali Baba Signs is a family-owned business based in Perth, Western Australia." sections={[
  { title: '1. Services Provided', paragraphs: ['Ali Baba Signs provides signage and printing services including flags, banners, mesh banners, vinyl printing, and custom signage solutions.', 'All products are custom-made based on the information, artwork, and specifications you provide.'] },
  { title: '2. Quotes & Pricing', items: ['All quotes are valid for 28 days unless stated otherwise.', 'Prices may change due to material costs, design changes, or special requirements.', 'All pricing is in Australian Dollars (AUD).'] },
  { title: '3. Orders & Artwork', items: ['Orders are confirmed once payment is received.', 'You are responsible for ensuring artwork files are correct, high-resolution, and free from errors.', 'We may adjust artwork for print quality.', 'We are not liable for errors, color differences, margins, files/logo quality etc. in the supplied artwork.'] },
  { title: '4. Production & Turnaround Times', items: ['Production times vary depending on product type and workload.', 'Estimated turnaround times are provided as guidance only.', 'Delays caused by suppliers, couriers, or unforeseen circumstances are outside our control and we are not responsible for any delays.'] },
  { title: '5. Shipping & Delivery', items: ['We ship Australia-wide using trusted courier partners.', 'Delivery times depend on location and courier schedules.', 'Risk of loss passes to you once the product is dispatched.'] },
  { title: '6. Cancellations', items: ['Orders cannot be cancelled once submitted.', 'Products are non-refundable unless faulty.'] },
  { title: '7. Liability', items: ['Losses caused by incorrect artwork', 'Delays in delivery', 'Damage caused by misuse, improper installation, or weather conditions', 'Indirect or consequential losses'], paragraphs: ['To the fullest extent permitted by law, Ali Baba Signs is not liable for the losses listed above.'] },
  { title: '8. Governing Law', paragraphs: ['These Terms are governed by the laws of Western Australia.'] },
  { title: '9. Contact Us', items: ['Email: sales@alibabasigns.com.au', 'Phone: 04 33 88 55 79', 'www.alibabasigns.com.au'] },
]} /> }

export function RefundReturnsContent() { return <PolicyContent title="Refund & Returns Policy" intro="Ali Baba Signs produces custom signage products made specifically to your order. As such, refunds and returns are limited under Australian Consumer Law (ACL)." sections={[
  { title: '1. Custom Products', paragraphs: ['Because all items are custom-printed, we cannot offer refunds or returns for:'], items: ['Change of mind', 'Incorrect artwork supplied', 'Incorrect specifications provided by the customer', 'Colour variations due to screen differences'] },
  { title: '2. Faulty or Defective Products', paragraphs: ['You are entitled to a repair, replacement, or refund if a product is faulty, damaged, or not as described.', 'We will assess the fault and provide a suitable remedy under ACL.'], items: ['You must notify us within 48 hours of receiving the product', 'Provide photos and a description of the issue', 'Return the item if requested', 'Do not accept the item if packaging is damaged.'] },
  { title: '3. Shipping Damage', items: ['Please take photographs/videos before opening the package, as evidence.', "If packaging is damaged, please don't accept it.", 'If your product is damaged inside the undamaged packaging, please contact us within 48 hours.', 'Provide photos of the packaging and product.', 'We will lodge a claim with the courier and assist with a replacement.'] },
  { title: '4. Incorrect Orders', paragraphs: ['If we make an error, we will replace or correct the product at no cost to you.'] },
  { title: '5. Non-Returnable Items', items: ['Custom printed products', 'Items damaged by misuse or improper installation', 'Products exposed to extreme weather beyond normal conditions'] },
  { title: '6. Contact Us', items: ['Email: sales@alibabasigns.com.au', 'Phone: 04 33 88 55 79', 'www.alibabasigns.com.au'] },
]} /> }

export function ShippingContent() { return <PolicyContent title="Shipping Policy" intro="Delivery and pickup information for Ali Baba Signs orders." sections={[
  { title: '1. Delivery Areas', paragraphs: ['We deliver Australia-wide, including metro and regional areas.'] },
  { title: '2. Processing Times', items: ['Standard production time: 5–10 business days, depending on product type', 'Orders are dispatched once production is complete', 'Urgent orders may be available upon request (fees may apply)'] },
  { title: '3. Shipping Methods', paragraphs: ['We use reputable courier services such as Australia Post, StarTrack, TNT, Aramex, DHL, UPS, etc. or whatever reliable source is available.', 'Tracking details may be provided once your order is dispatched.'] },
  { title: '4. Shipping Costs', items: ['Product size', 'Weight', 'Delivery location', 'Shipping fees are displayed at checkout or included in your quote.'] },
  { title: '5. Delays', paragraphs: ['Ali Baba Signs is not responsible for courier delays caused by:'], items: ['Weather', 'Peak periods', 'Remote locations', 'Operational issues within courier networks'] },
  { title: '6. Lost or Missing Parcels', items: ['We will lodge an investigation with the courier', 'Replacement will be issued once confirmed lost'] },
  { title: '7. Local Pickup', paragraphs: ['Pickup is available from our Perth location by appointment only.'] },
  { title: '8. Contact Us', items: ['Email: sales@alibabasigns.com.au', 'Phone: 04 33 88 55 79', 'www.alibabasigns.com.au'] },
]} /> }

export function WarrantyContent() { return <PolicyContent title="Warranty Disclaimer" intro="Ali Baba Signs provides a limited warranty on manufacturing defects for a period of 28 days from delivery." sections={[
  { title: '1. Product Warranty', paragraphs: ['This warranty covers:'], items: ['Printing defects', 'Material faults', 'Stitching or finishing issues'] },
  { title: '2. Warranty Exclusions', items: ['Damage caused by weather (wind, storms, UV exposure)', 'Improper installation', 'Normal wear and tear', 'Fading due to sun exposure', 'Damage caused by accidents or misuse', 'Incorrect handling, storage or installation'], paragraphs: ['Outdoor signage is subject to environmental conditions beyond our control.'] },
  { title: '3. Customer Responsibilities', items: ['Install products correctly', 'Use products for their intended purpose', 'Store items safely when not in use'] },
  { title: '4. Remedies', items: ['Repair the product, or', 'Replace the product (if non-repairable), or', 'Offer a partial refund (if repair or replacement is not possible)'] },
  { title: '5. Limitation of Liability', paragraphs: ['To the extent permitted by law, Ali Baba Signs is not liable for:'], items: ['Loss of business or income', 'Consequential or indirect damages', 'Costs associated with installation or removal'] },
  { title: '6. Contact Us', items: ['Email: sales@alibabasigns.com.au', 'Phone: 04 33 88 55 79'] },
]} /> }

export function CookieContent(){return <ContentPage eyebrow="Legal" title="Cookie Policy" intro="Cookies and local storage keep essential site features working and help us understand service performance."><ContentSection title="Essential storage"><p>Authentication cookies keep signed-in sessions secure. Local storage keeps cart selections on the current device.</p></ContentSection></ContentPage>}
