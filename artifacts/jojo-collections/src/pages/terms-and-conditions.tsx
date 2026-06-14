import { Link } from "wouter";
import { Layout } from "@/components/layout";

export default function TermsAndConditions() {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="glass-panel-heavy rounded-3xl p-8 md:p-12 border-white/50 space-y-8">

          <div className="space-y-2">
            <h1 className="text-3xl font-serif text-blue-950">Terms &amp; Conditions</h1>
            <p className="text-sm text-blue-800/50">Last updated: June 2026</p>
          </div>

          <p className="text-blue-900/70 leading-relaxed">
            Welcome to Lenz Fragrances. By accessing or using our website and placing an order,
            you agree to be bound by these Terms and Conditions. Please read them carefully
            before making a purchase. If you do not agree, please do not use our site.
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">1. About Us</h2>
            <p className="text-blue-900/70 leading-relaxed">
              Lenz Fragrances is an online perfume and fragrance store based in Uganda. We
              sell authentic fragrances directly to customers across Uganda. For any queries,
              contact us at{" "}
              <a href="mailto:levixticus67@gmail.com" className="text-amber-600 hover:underline">
                levixticus67@gmail.com
              </a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">2. Acceptance of Terms</h2>
            <p className="text-blue-900/70 leading-relaxed">
              By creating an account, browsing the site, or placing an order, you confirm
              that you are at least 13 years old and have the legal capacity to enter into
              a binding agreement under Ugandan law. These terms apply to all visitors,
              registered users, and customers.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">3. Products &amp; Pricing</h2>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li>All prices are displayed in the selected store currency and include any applicable taxes unless stated otherwise.</li>
              <li>Prices may change at any time without prior notice. The price you pay is the price shown at the time you complete your order.</li>
              <li>Product images and descriptions are as accurate as possible, but slight variations in colour, bottle appearance, or packaging may occur.</li>
              <li>We reserve the right to withdraw any product from sale at any time, including after an order has been placed. In such cases, you will be notified and offered a full refund or alternative product.</li>
              <li>Bundle prices apply only when all items in the bundle are in stock at the time of checkout.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">4. Orders &amp; Payment</h2>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li>Submitting an order is an offer to purchase — it is not a confirmed sale until we accept it. We reserve the right to decline any order without providing a reason.</li>
              <li>We accept payment via <strong>Pesapal</strong> (mobile money and card) and <strong>Cash on Delivery (COD)</strong>. The available options are shown at checkout.</li>
              <li>For COD orders, payment must be made in full at the point of delivery. Repeated refusal to pay upon delivery may result in your account being suspended and future orders requiring prepayment.</li>
              <li><strong>Coupon codes</strong> are subject to their stated terms. Only one coupon may be applied per order. Coupons have no cash value, are non-transferable, and cannot be combined with other promotions unless explicitly stated.</li>
              <li>Any order suspected of fraud, abuse of promotions, or multiple accounts used to circumvent limits will be cancelled and the account reviewed.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">5. Delivery</h2>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li>We currently deliver within <strong>Uganda only</strong>. Delivery availability to specific locations may vary.</li>
              <li>Estimated delivery times are provided as a guide and are not guaranteed. Delays may occur due to weather, logistics, or other circumstances beyond our control.</li>
              <li>You are responsible for providing a complete and accurate delivery address. We are not liable for failed deliveries caused by incorrect or incomplete address information.</li>
              <li>Risk of loss or damage to products passes to you once the order is handed to our delivery partner or courier.</li>
              <li>If you are unavailable at delivery and the order is returned to us, a redelivery fee may apply.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">6. Returns &amp; Refunds</h2>
            <p className="text-blue-900/70 leading-relaxed">Due to the personal nature of fragrance products, we have a strict returns policy:</p>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li><strong>Opened or used products cannot be returned</strong> for hygiene and safety reasons. All sales on opened items are final.</li>
              <li>If you receive a <strong>damaged, defective, or incorrect item</strong>, you must notify us within <strong>48 hours</strong> of delivery with photographic evidence. We will arrange a replacement or full refund at our discretion.</li>
              <li>Refunds for prepaid orders (Pesapal) will be processed within 7 business days to the original payment method.</li>
              <li>We do not accept returns based on personal preference (e.g. the scent is not to your liking after purchase). We encourage you to read fragrance notes carefully before ordering.</li>
              <li>COD orders that are refused at the door without a valid reason may result in the customer being blocked from future COD orders.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">7. Your Account</h2>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li>You are responsible for maintaining the confidentiality of your account password. We are not liable for any loss resulting from unauthorised access caused by your failure to keep your credentials secure.</li>
              <li>You must register with a valid email address. Accounts created with false information may be deleted without notice.</li>
              <li>One account per person. Creating multiple accounts to abuse discounts, coupons, or referral programmes is prohibited and grounds for permanent suspension.</li>
              <li>We reserve the right to suspend or terminate any account that violates these terms.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">8. Prohibited Use</h2>
            <p className="text-blue-900/70 leading-relaxed">You may not use this site to:</p>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li>Scrape, crawl, or use automated tools to extract data or place orders.</li>
              <li>Post fake, misleading, or malicious product reviews.</li>
              <li>Impersonate Lenz Fragrances staff or other customers.</li>
              <li>Abuse coupons, bundles, or promotional offers through multiple accounts.</li>
              <li>Engage in any activity that disrupts or damages the site or its services.</li>
            </ul>
            <p className="text-blue-900/70 leading-relaxed">Violation of any of the above may result in immediate account termination and, where applicable, legal action.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">9. Intellectual Property</h2>
            <p className="text-blue-900/70 leading-relaxed">
              All content on this site — including product images, descriptions, logos, branding, and design — is the property of Lenz Fragrances or our licensed suppliers. You may not reproduce, copy, or redistribute any content without our express written permission.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">10. Limitation of Liability</h2>
            <p className="text-blue-900/70 leading-relaxed">To the fullest extent permitted by Ugandan law, Lenz Fragrances shall not be liable for:</p>
            <ul className="list-disc list-inside space-y-2 text-blue-900/70">
              <li>Delivery delays caused by third-party couriers or circumstances outside our control.</li>
              <li>Allergic reactions or sensitivities to fragrance products. Customers with known allergies should review ingredient/note information before purchasing.</li>
              <li>Loss or damage arising from an incorrect delivery address provided by the customer.</li>
              <li>Indirect, incidental, or consequential losses arising from use of our site or products.</li>
            </ul>
            <p className="text-blue-900/70 leading-relaxed">Our total liability to you shall not exceed the amount you paid for the order in question.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">11. Third-Party Services</h2>
            <p className="text-blue-900/70 leading-relaxed">
              Our site uses third-party services including Pesapal (payments), Firebase (authentication and database), Cloudinary (media), and Render (backend infrastructure). We are not responsible for the availability, security, or practices of these third-party platforms. Their own terms and privacy policies apply to their respective services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">12. Governing Law &amp; Disputes</h2>
            <p className="text-blue-900/70 leading-relaxed">
              These Terms and Conditions are governed by the laws of the Republic of Uganda. Any dispute arising from these terms or your use of the site shall be subject to the exclusive jurisdiction of the courts of Uganda. We encourage you to contact us first at{" "}
              <a href="mailto:levixticus67@gmail.com" className="text-amber-600 hover:underline">
                levixticus67@gmail.com
              </a>{" "}
              to resolve any issue before pursuing formal proceedings.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">13. Changes to These Terms</h2>
            <p className="text-blue-900/70 leading-relaxed">
              We reserve the right to update these Terms and Conditions at any time. Changes will be posted on this page with an updated date. Your continued use of the site after any changes constitutes your acceptance of the revised terms. We recommend reviewing this page periodically.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-blue-950">14. Contact Us</h2>
            <p className="text-blue-900/70 leading-relaxed">If you have any questions about these Terms and Conditions, please reach out:</p>
            <ul className="list-none space-y-1 text-blue-900/70">
              <li><strong>Email:</strong>{" "}<a href="mailto:levixticus67@gmail.com" className="text-amber-600 hover:underline">levixticus67@gmail.com</a></li>
              <li><strong>Location:</strong> Uganda</li>
            </ul>
          </section>

          <div className="border-t border-white/20 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/privacy-policy" className="text-sm text-amber-600 hover:underline">
              View our Privacy Policy →
            </Link>
            <Link href="/" className="text-sm text-amber-600 hover:underline">
              ← Back to Home
            </Link>
          </div>

        </div>
      </div>
    </Layout>
  );
}
