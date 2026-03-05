import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type {
  BusinessProfile,
  ActionCard,
  RecommendationImpact,
  ActionsResponse,
} from "@/lib/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Schema type mapping ──────────────────────────────────────────────────────

function schemaType(businessType: string): string {
  const t = businessType.toLowerCase();
  if (/gym|fitness|crossfit|pilates|yoga|sports/.test(t)) return "HealthClub";
  if (/restaurant|cafe|bistro|bar|pub|diner|eatery|food/.test(t)) return "Restaurant";
  if (/store|shop|boutique|retail/.test(t)) return "Store";
  if (/hotel|hostel|motel|inn|lodge/.test(t)) return "LodgingBusiness";
  if (/salon|spa|barber|beauty/.test(t)) return "BeautySalon";
  if (/dental|dentist/.test(t)) return "Dentist";
  if (/doctor|clinic|medical|health/.test(t)) return "MedicalClinic";
  return "LocalBusiness";
}

// ─── Action generators ────────────────────────────────────────────────────────

function schemaAction(profile: BusinessProfile, url: string): ActionCard {
  const snippet = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": schemaType(profile.type),
      name: profile.name,
      description: profile.description,
      url: url,
      address: {
        "@type": "PostalAddress",
        addressLocality: profile.location,
      },
      ...(profile.signals.reviewRating && profile.signals.reviewCount
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: profile.signals.reviewRating,
              reviewCount: profile.signals.reviewCount,
            },
          }
        : {}),
    },
    null,
    2
  );

  return {
    id: "schema-json-ld",
    title: "Add Schema.org JSON-LD markup",
    whyItMatters:
      "Structured data is the clearest signal AI assistants and search engines use to understand your business. Without it, LLMs rely on less reliable sources to describe you.",
    impact: "High",
    content: `<!-- Paste this inside the <head> tag of your website -->\n<script type="application/ld+json">\n${snippet}\n</script>`,
    contentType: "code",
  };
}

function metaDescriptionAction(profile: BusinessProfile): ActionCard {
  const services = profile.services.slice(0, 2).join(" and ");
  const description = `${profile.name} is a ${profile.type} in ${profile.location}${services ? ` specialising in ${services}` : ""}. ${profile.description.split(".")[0]}.`;
  const trimmed = description.length > 160 ? description.slice(0, 157) + "..." : description;

  return {
    id: "meta-description",
    title: "Add an optimised meta description",
    whyItMatters:
      "AI assistants and search crawlers use meta descriptions to understand what your page is about. A missing or empty description means you're leaving the narrative to chance.",
    impact: "Medium",
    content: `<!-- Paste this inside the <head> tag of your website -->\n<meta name="description" content="${trimmed}" />`,
    contentType: "code",
  };
}

function titleTagAction(profile: BusinessProfile): ActionCard {
  const title = `${profile.name} | ${profile.type.charAt(0).toUpperCase() + profile.type.slice(1)} in ${profile.location}`;

  return {
    id: "title-tag",
    title: "Add an optimised title tag",
    whyItMatters:
      "The title tag is the first thing AI models and search engines index. A generic or missing title hurts discoverability across all AI assistants.",
    impact: "Medium",
    content: `<!-- Replace your existing <title> tag in <head> with this -->\n<title>${title}</title>`,
    contentType: "code",
  };
}

function mapsEmbedAction(profile: BusinessProfile): ActionCard {
  return {
    id: "maps-embed",
    title: "Embed Google Maps on your website",
    whyItMatters:
      "A Google Maps embed confirms your physical location to AI assistants and strengthens local presence signals. It also makes it easier for customers to find you.",
    impact: "Low",
    content: `1. Go to Google Maps (maps.google.com) and search for "${profile.name}" in ${profile.location}.
2. Click on your business listing to open it.
3. Click the Share icon → "Embed a map".
4. Copy the <iframe> HTML code shown.
5. Paste it into your website's contact page or footer.`,
    contentType: "steps",
  };
}

function reviewTemplatesAction(profile: BusinessProfile): ActionCard {
  return {
    id: "review-templates",
    title: "Review response templates",
    whyItMatters:
      "Responding to reviews signals to AI assistants that your business is active and engaged. Regular responses improve your GBP ranking and give LLMs fresh content to index.",
    impact: "Medium",
    content: `--- POSITIVE REVIEW ---
Thank you so much for your kind words! We're thrilled you had a great experience at ${profile.name}. Our team works hard to [provide excellent service / deliver quality results], and it means a lot to hear this. We look forward to seeing you again soon!

--- NEUTRAL REVIEW ---
Thanks for taking the time to share your feedback about ${profile.name}. We're glad you enjoyed [positive aspect], and we've noted your comments about [area for improvement] — we're always looking to improve. Don't hesitate to reach out directly if there's anything we can do better.

--- NEGATIVE REVIEW ---
We're sorry to hear your visit to ${profile.name} didn't meet your expectations. This is not the standard we hold ourselves to, and we'd really like to make it right. Please contact us directly at [your email/phone] so we can look into this personally. Thank you for giving us the chance to improve.`,
    contentType: "text",
  };
}

function reviewIncentiveAction(profile: BusinessProfile): ActionCard {
  return {
    id: "review-incentive",
    title: "Grow your Google review count",
    whyItMatters:
      "AI assistants weigh review volume and recency heavily when deciding whether to recommend a business. More recent 5-star reviews directly improve your LLM visibility score.",
    impact: "High",
    content: `1. After a positive interaction, say to the customer:
   "If you enjoyed your experience, a quick Google review would mean the world to us!"

2. Make it frictionless — create a short Google review link:
   • Go to your Google Business Profile dashboard
   • Click "Get more reviews" → copy the short URL
   • Add it to your email footer, receipts, and WhatsApp messages

3. Send a follow-up message to recent customers:
   "Hi! Thanks for visiting ${profile.name} recently. If you have 30 seconds, a Google review helps us a lot: [YOUR LINK]"

4. Add a small sign at the counter or checkout with a QR code linking to your review page.`,
    contentType: "steps",
  };
}

function socialBioAction(profile: BusinessProfile): ActionCard {
  const services = profile.services.slice(0, 3).join(", ");
  const bio = `${profile.name} | ${profile.type.charAt(0).toUpperCase() + profile.type.slice(1)} in ${profile.location} | ${services || profile.description.split(".")[0]} | 📍 ${profile.location}`;

  return {
    id: "social-bio",
    title: "Optimise your social media bios",
    whyItMatters:
      "Consistent NAP (Name, Address, Phone) across social platforms helps AI assistants confidently identify and describe your business. Inconsistency creates ambiguity.",
    impact: "Low",
    content: `Use this consistent bio across all your social profiles (Instagram, Facebook, LinkedIn, X):

"${bio}"

Make sure your Name, Address, and Phone number are identical across every platform and match exactly what's on your Google Business Profile.`,
    contentType: "text",
  };
}

function gbpPostAction(profile: BusinessProfile): ActionCard {
  return {
    id: "gbp-post",
    title: "Publish your first Google Business Profile post",
    whyItMatters:
      "GBP posts are indexed by Google and read by AI assistants. Regular posts signal that your business is active — a key factor in AI recommendation ranking.",
    impact: "Medium",
    content: `Here's a ready-to-use first post for your Google Business Profile:

---
Welcome to ${profile.name}!

We're ${profile.description.split(".")[0].toLowerCase()}, proudly serving ${profile.location}.

${profile.services.length > 0 ? `What we offer:\n${profile.services.slice(0, 4).map((s) => `• ${s}`).join("\n")}` : ""}

Come visit us or get in touch — we'd love to meet you!
---

To post: Go to your Google Business Profile → "Add update" → paste the text above → add a photo → Publish.`,
    contentType: "text",
  };
}

async function blogPostAction(profile: BusinessProfile): Promise<ActionCard> {
  const base: Omit<ActionCard, "content" | "isPlaceholder"> = {
    id: "blog-post-intro",
    title: "Blog post: Introduce your business",
    whyItMatters:
      "Blog content is one of the richest signals AI assistants use to understand and recommend businesses. A well-written post that mentions your services, location, and story dramatically improves LLM visibility.",
    impact: "High",
    contentType: "markdown",
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert local SEO content writer. Write in a warm, professional tone that feels authentic to a small business owner. Output only the blog post content in Markdown — no preamble, no commentary.",
        },
        {
          role: "user",
          content: `Write a 500–800 word blog post for the following local business. The post should introduce the business, highlight what makes it special, mention its key services, and include the business name and location naturally throughout. End with a clear call to action to visit or get in touch.

Do not invent specific people, names, dates, awards, or any facts not present in the information provided below. Only use what is given.

Business name: ${profile.name}
Type: ${profile.type}
Location: ${profile.location}
Description: ${profile.description}
Services: ${profile.services.join(", ") || "general services"}

Format with a # title, ## subheadings, and a short concluding paragraph with a call to action.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) throw new Error("Empty response");
    return { ...base, content };
  } catch {
    // Fallback to template on LLM failure
    const services = profile.services.slice(0, 3);
    const serviceList = services.map((s) => `- **${s}**: Add a sentence explaining what makes your ${s} offering stand out.`).join("\n");
    const content = `# Why ${profile.name} Is ${profile.location}'s Go-To ${profile.type.charAt(0).toUpperCase() + profile.type.slice(1)}

## Our Story
${profile.name} has been serving the ${profile.location} community with passion and dedication. What started as a commitment to [your origin story] has grown into ${profile.location}'s trusted ${profile.type}.

## What We Offer
${profile.description}

${services.length > 0 ? `Here's what you can expect when you visit us:\n\n${serviceList}` : ""}

## Why ${profile.location} Trusts Us
Unlike other options in ${profile.location}, we focus on delivering a personalised experience every time. Our team is dedicated to [your key differentiator].

## Visit Us
We'd love to welcome you to ${profile.name}. Whether you're a first-time visitor or a regular, we're here to [deliver your core value proposition].

*[Add your address, opening hours, and a call-to-action button here]*`;
    return { ...base, content, isPlaceholder: true };
  }
}

async function faqAction(profile: BusinessProfile): Promise<ActionCard> {
  const base: Omit<ActionCard, "content" | "isPlaceholder"> = {
    id: "faq-draft",
    title: "FAQ page draft",
    whyItMatters:
      "FAQ pages are goldmines for AI assistants — they contain exactly the question-and-answer format LLMs use when responding to customer queries. Adding an FAQ page with relevant questions significantly increases your chance of being cited.",
    impact: "High",
    contentType: "markdown",
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert local SEO content writer. Write in a warm, helpful tone. Output only the FAQ content in Markdown — no preamble, no commentary.",
        },
        {
          role: "user",
          content: `Write 10 genuine, specific FAQ questions and answers for the following local business. Questions should reflect what real customers actually ask — about services, booking, location, pricing, and what makes this business special. Ground the answers strictly in the business's actual description and services; do not invent facts, specific people, names, dates, or awards not present in the information provided. Where specific details are unknown (e.g. exact prices, phone number), use a placeholder like [add your price here].

Business name: ${profile.name}
Type: ${profile.type}
Location: ${profile.location}
Description: ${profile.description}
Services: ${profile.services.join(", ") || "general services"}

Format each entry as:
### [Question]
[Answer]`,
        },
      ],
      temperature: 0.6,
      max_tokens: 1500,
    });

    const faqContent = completion.choices[0]?.message?.content?.trim();
    if (!faqContent) throw new Error("Empty response");
    const content = `# Frequently Asked Questions — ${profile.name}\n\n${faqContent}`;
    return { ...base, content };
  } catch {
    // Fallback to category-based templates on LLM failure
    const t = profile.type.toLowerCase();
    let faqs: [string, string][];

    if (/gym|fitness|crossfit|pilates|yoga|sports/.test(t)) {
      faqs = [
        [`What are the membership options at ${profile.name}?`, `We offer a range of memberships including monthly, quarterly, and annual plans. Visit our website or drop in to speak with our team about what suits you best.`],
        [`Do you offer personal training?`, `Yes! Our qualified personal trainers can create a programme tailored to your goals. Ask at reception to book a free consultation.`],
        [`Is ${profile.name} suitable for beginners?`, `Absolutely. We welcome members of all fitness levels and our team is always on hand to help you get started safely.`],
        [`What are your opening hours?`, `[Add your opening hours here]. Check our Google Business Profile for public holiday hours.`],
        [`Do I need to book classes in advance?`, `Some classes require booking — check our schedule online or via our app. Drop-in is welcome for gym floor access.`],
        [`Is there parking available?`, `[Add parking details for ${profile.location} here].`],
        [`Can I pause my membership?`, `Yes, membership freezes are available in certain circumstances. Contact us directly to discuss your options.`],
        [`Do you offer a free trial?`, `We offer a free introductory session for new members. Get in touch to arrange yours.`],
      ];
    } else if (/restaurant|cafe|bistro|bar|pub|diner|eatery|food/.test(t)) {
      faqs = [
        [`Does ${profile.name} take reservations?`, `Yes, we recommend booking in advance, especially on weekends. You can reserve a table via [booking link] or by calling us directly.`],
        [`Do you cater for dietary requirements?`, `We offer vegetarian, vegan, and gluten-free options. Please let us know about any allergies when booking and our kitchen will accommodate you.`],
        [`What are your opening hours?`, `[Add your opening hours here]. Check our Google Business Profile for up-to-date hours including public holidays.`],
        [`Is there parking nearby?`, `[Add parking details for ${profile.location} here].`],
        [`Do you offer takeaway or delivery?`, `[Add your takeaway/delivery policy here].`],
        [`Can you host private events or group bookings?`, `Yes! We love hosting private dining events. Contact us at [email/phone] to discuss your requirements.`],
        [`Is ${profile.name} child-friendly?`, `[Add your children's policy here].`],
        [`Do you have a loyalty programme?`, `[Add loyalty programme details here, or remove this question if not applicable].`],
      ];
    } else {
      faqs = [
        [`What does ${profile.name} offer?`, profile.description],
        [`Where is ${profile.name} located?`, `We're based in ${profile.location}. [Add full address here].`],
        [`What are your opening hours?`, `[Add your opening hours here]. You can also find them on our Google Business Profile.`],
        [`How can I get in touch?`, `You can reach us via [email], [phone], or through the contact form on our website.`],
        [`Do you offer appointments or walk-ins?`, `[Add your booking policy here].`],
        [`What makes ${profile.name} different?`, `${profile.description.split(".")[0]}. We pride ourselves on [your key differentiator].`],
        [`Do you offer gift cards or vouchers?`, `[Add gift card policy here].`],
        [`Is there parking available?`, `[Add parking details for ${profile.location} here].`],
      ];
    }

    const faqMarkdown = faqs.map(([q, a]) => `### ${q}\n${a}`).join("\n\n");
    const content = `# Frequently Asked Questions — ${profile.name}\n\n${faqMarkdown}\n\n---\n*[Review and customise all answers with your specific details before publishing.]*`;
    return { ...base, content, isPlaceholder: true };
  }
}

// ─── Main generator ───────────────────────────────────────────────────────────

async function generateActions(profile: BusinessProfile, url: string): Promise<ActionCard[]> {
  const { signals } = profile;

  // Sync actions (no LLM calls)
  const syncActions: ActionCard[] = [];
  if (!signals.hasSchema) syncActions.push(schemaAction(profile, url));
  if (!signals.reviewCount || signals.reviewCount < 50) syncActions.push(reviewIncentiveAction(profile));
  if (!signals.hasMetaDescription) syncActions.push(metaDescriptionAction(profile));
  if (!signals.titleTag) syncActions.push(titleTagAction(profile));
  if (signals.hasGoogleBusinessProfile) syncActions.push(gbpPostAction(profile));
  if (!signals.reviewCount || signals.reviewCount < 30) syncActions.push(reviewTemplatesAction(profile));
  if (signals.socialLinks.length < 2) syncActions.push(socialBioAction(profile));
  if (!signals.hasMapsEmbed) syncActions.push(mapsEmbedAction(profile));

  // LLM-generated actions — run in parallel
  const llmActions: ActionCard[] = [];
  const llmPromises: Promise<ActionCard>[] = [];
  if (!signals.hasBlog) llmPromises.push(blogPostAction(profile));
  if (!signals.hasFAQ) llmPromises.push(faqAction(profile));
  llmActions.push(...(await Promise.all(llmPromises)));

  const all = [...syncActions, ...llmActions];
  const impactOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  return all.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { profile, url } = await req.json();

    if (!profile || !url) {
      return NextResponse.json({ error: "profile and url are required" }, { status: 400 });
    }

    const actions = await generateActions(profile as BusinessProfile, url as string);
    return NextResponse.json({ actions } satisfies ActionsResponse);
  } catch {
    return NextResponse.json({ error: "Failed to generate actions" }, { status: 500 });
  }
}
