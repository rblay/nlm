"use client";

import React, { useState, useRef, useEffect } from "react";
import type {
  BusinessProfile,
  Recommendation,
  RecommendationImpact,
  ScoreResult,
  LLMProvider,
  ActionCard,
} from "@/lib/types";

// ─── Testing mode ─────────────────────────────────────────────────────────────

type TestingMode = "all" | "score-only" | "rec-only" | "fake";

const FAKE_PROFILE: BusinessProfile = {
  name: "Apex Fitness Studio",
  type: "Personal Training Studio",
  location: "Shoreditch, London",
  description: "A boutique personal training studio in the heart of Shoreditch offering bespoke strength and conditioning programmes for all fitness levels. Our coaches design every programme around the individual.",
  services: ["1-to-1 personal training", "Small group HIIT classes", "Nutrition coaching", "Body composition analysis", "Mobility & recovery sessions"],
  signals: {
    hasSchema: false, hasBlog: false, hasFAQ: false, hasMetaDescription: true,
    titleTag: "Apex Fitness Studio | Personal Training Shoreditch",
    socialLinks: ["https://instagram.com/apexfitnesslondon"],
    hasMapsEmbed: false, hasGoogleBusinessProfile: true, gbpHasHours: true,
    gbpPhotoCount: 4, reviewCount: 31, reviewRating: 4.7,
  },
};

const FAKE_QUERIES = [
  "best personal training studios in Shoreditch",
  "beginner-friendly gyms in East London",
  "strength training classes for women Shoreditch",
  "HIIT classes near Shoreditch London",
];

const FAKE_INTENTS = [
  "find a personal trainer in Shoreditch",
  "beginner gym options in East London",
  "strength training for women",
  "high-intensity interval training classes nearby",
];

const FAKE_SCORE_RESULT: ScoreResult = {
  overallScore: 42,
  perLLM: [
    { llm: "openai",    score: 50, mentions: 2, totalQueries: 4 },
    { llm: "anthropic", score: 25, mentions: 1, totalQueries: 4 },
    { llm: "gemini",    score: 50, mentions: 2, totalQueries: 4 },
  ],
  intents: FAKE_INTENTS,
  queries: FAKE_QUERIES,
  debug: [
    { query: FAKE_QUERIES[0], llm: "openai",    response: "Top PT studios in Shoreditch include Apex Fitness Studio, known for bespoke strength programmes.", mentioned: true,  latencyMs: 1240 },
    { query: FAKE_QUERIES[0], llm: "anthropic", response: "In Shoreditch you'll find Third Space and F45. Smaller boutique studios are less commonly cited.", mentioned: false, latencyMs: 2100 },
    { query: FAKE_QUERIES[0], llm: "gemini",    response: "Apex Fitness Studio in Shoreditch is well-regarded for personal training.", mentioned: true,  latencyMs: 980  },
    { query: FAKE_QUERIES[1], llm: "openai",    response: "For beginners in East London, PureGym and Nuffield Health are popular choices.", mentioned: false, latencyMs: 1150 },
    { query: FAKE_QUERIES[1], llm: "anthropic", response: "East London has many gyms for beginners including several boutique studios.", mentioned: false, latencyMs: 1890 },
    { query: FAKE_QUERIES[1], llm: "gemini",    response: "Beginners in East London often choose Apex Fitness Studio for structured onboarding.", mentioned: true,  latencyMs: 1020 },
    { query: FAKE_QUERIES[2], llm: "openai",    response: "Apex Fitness Studio offers women-focused strength programmes in Shoreditch.", mentioned: true,  latencyMs: 1310 },
    { query: FAKE_QUERIES[2], llm: "anthropic", response: "There are several studios offering women's strength training in East London.", mentioned: false, latencyMs: 2050 },
    { query: FAKE_QUERIES[2], llm: "gemini",    response: "For women's strength training in Shoreditch, options include F45 and boutique studios.", mentioned: false, latencyMs: 1100 },
    { query: FAKE_QUERIES[3], llm: "openai",    response: "HIIT classes in Shoreditch are offered by Barry's Bootcamp and independent studios.", mentioned: false, latencyMs: 1200 },
    { query: FAKE_QUERIES[3], llm: "anthropic", response: "Apex Fitness Studio offers HIIT classes in Shoreditch alongside personal training.", mentioned: true,  latencyMs: 1980 },
    { query: FAKE_QUERIES[3], llm: "gemini",    response: "Popular HIIT options in Shoreditch include F45, Barry's and smaller boutique studios.", mentioned: false, latencyMs: 950  },
  ],
  summary: "Apex Fitness Studio appears in roughly half of AI responses for branded queries but is rarely surfaced for generic discovery searches. ChatGPT and Gemini mention it for strength-focused queries, while Claude rarely surfaces it. The business is missing from high-volume beginner and HIIT queries, pointing to low content authority and absent Schema markup.",
};

const FAKE_BLOG_CONTENT = `# 5 Things to Know Before Starting Personal Training in Shoreditch

Whether you're new to the gym or returning after a break, starting a personal training programme is one of the most effective ways to reach your fitness goals. Here's what you need to know before your first session at Apex Fitness Studio.

## 1. Your First Session Is an Assessment

At Apex, we begin every new client relationship with a thorough fitness assessment. We look at your movement patterns, strength baselines, and lifestyle factors — not to judge, but to build a programme that's right for you.

## 2. Consistency Beats Intensity

The most common mistake people make is going too hard too soon. Sustainable progress comes from showing up regularly and allowing your body to adapt. Our coaches build progressive programmes designed for the long term.

## 3. Nutrition Is Half the Picture

Training results are deeply tied to what you eat. Our nutrition coaching services help you understand the fundamentals without restrictive dieting — real food, sensible portions, and habits that stick.

## 4. Shoreditch Has Unique Challenges

From long working hours to packed commutes, our Shoreditch clients face real demands on their time and energy. We design flexible session schedules and short, high-efficiency workouts for busy professionals.

## 5. Small Groups Can Be Just as Effective

If 1-to-1 personal training isn't right for your budget, our small group HIIT classes offer personalised attention at a fraction of the cost. Groups are capped at 6 people so everyone gets coached properly.

Ready to get started? Book a free taster session at Apex Fitness Studio today.`;

const FAKE_FAQ_CONTENT = `Q1: What types of training do you offer at Apex Fitness Studio?
A1: We offer 1-to-1 personal training, small group HIIT classes (max 6 people), nutrition coaching, and body composition analysis. All programmes are tailored to your individual goals and fitness level.

Q2: Where are you located in Shoreditch?
A2: We're based in the heart of Shoreditch, East London — easily accessible from Shoreditch High Street and Old Street stations. Full address is provided on booking confirmation.

Q3: Do I need prior gym experience to join?
A3: Not at all. We welcome complete beginners and design programmes around your current level. Your first session includes a fitness assessment so we can build the right plan for you.

Q4: How much do sessions cost?
A4: 1-to-1 personal training starts from £65 per session, with discounts for block bookings. HIIT class passes are available from £15 per class. Contact us for current pricing and packages.

Q5: Can you help with weight loss specifically?
A5: Yes — weight management is one of our most common goals. We combine resistance training, cardio programming, and nutritional guidance to help you lose fat and build sustainable healthy habits.

Q6: What should I bring to my first session?
A6: Just bring comfortable workout clothes, trainers, and a water bottle. We provide all equipment and will walk you through everything on your first visit.

Q7: Do you offer nutrition coaching as a standalone service?
A7: Yes. Nutrition coaching is available separately from personal training. Sessions focus on building practical habits, understanding macronutrients, and creating a sustainable eating plan.

Q8: How do I book a session?
A8: You can book through our website or call us directly. We also offer a free 30-minute taster session for new clients — a great way to see if we're the right fit before committing.`;

const FAKE_RECOMMENDATIONS: Recommendation[] = [
  { title: "Add Schema.org markup", whyItMatters: "Without structured data, AI models struggle to extract accurate business details from your website. Schema markup is the single highest-impact technical fix.", observed: "No JSON-LD schema detected on homepage.", impact: "High", firstAction: "Add a LocalBusiness JSON-LD snippet to your homepage <head>." },
  { title: "Publish a blog or news section", whyItMatters: "Fresh, indexed content signals authority to LLMs. Businesses with active blogs are cited significantly more often in AI-generated local recommendations.", observed: "No blog or news section detected.", impact: "High", firstAction: "Write 2-3 posts covering common customer questions." },
  { title: "Create an FAQ page", whyItMatters: "FAQ pages are heavily used by AI models as a source of factual answers. A well-structured FAQ increases the chance your business is cited for question-based queries.", observed: "No FAQ page detected.", impact: "High", firstAction: "Add a dedicated FAQ page covering your most common customer questions." },
  { title: "Add more Google Business Profile photos", whyItMatters: "Listings with 10+ photos rank higher in local packs and are more likely to be referenced by AI models when describing local businesses.", observed: "Only 4 photos on GBP (target: 10+).", impact: "Medium", firstAction: "Upload at least 6 more photos: studio interior, trainers in action, equipment." },
];

const FAKE_ACTIONS: ActionCard[] = [
  {
    id: "schema", title: "Schema.org JSON-LD snippet", impact: "High",
    whyItMatters: "Paste this into your homepage <head> so AI models can reliably extract your business details.",
    content: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "HealthClub",
  "name": "Apex Fitness Studio",
  "url": "https://apexfitness.co.uk",
  "telephone": "+44-20-0000-0000",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Example Street",
    "addressLocality": "Shoreditch",
    "addressRegion": "London",
    "postalCode": "E1 6AA",
    "addressCountry": "GB"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 51.5225,
    "longitude": -0.0787
  },
  "openingHours": ["Mo-Fr 06:30-21:00", "Sa-Su 08:00-18:00"],
  "priceRange": "££"
}
</script>`,
    contentType: "code",
  },
  {
    id: "blog", title: "Blog post draft", impact: "High",
    whyItMatters: "Publish this post on your website to build content authority and increase the chance AI models cite you for training-related queries in Shoreditch.",
    content: FAKE_BLOG_CONTENT,
    contentType: "text",
  },
  {
    id: "faq", title: "FAQ page content", impact: "High",
    whyItMatters: "Add these Q&As to a dedicated FAQ page on your website. AI models use FAQ pages as a primary source for factual answers about local businesses.",
    content: FAKE_FAQ_CONTENT,
    contentType: "text",
  },
  {
    id: "gbp-photos", title: "GBP photo checklist", impact: "Medium",
    whyItMatters: "Upload at least 6 more photos to reach the 10-photo threshold that boosts local pack ranking.",
    content: `Photos to upload to your Google Business Profile:

1. Studio exterior / entrance (street-facing shot)
2. Studio interior — wide angle showing equipment
3. Trainer working 1-to-1 with a client
4. HIIT class in session (group energy)
5. Weights / equipment close-up
6. Nutrition consultation setup
7. Body composition analysis equipment
8. Reception / welcome area (if applicable)

Tips:
- Use natural light where possible
- Minimum 720px resolution
- JPG or PNG format
- Add a short description to each photo`,
    contentType: "steps",
  },
];

// ─── Demo mode data (Quinta Pupusas) ─────────────────────────────────────────

const DEMO_URL = "https://www.quintapupusas.com/";

// NOTE: these are the demo-only step labels — no product/tool names, business-flavoured only.
// To update for a different demo business, just edit this object.
const DEMO_STEP_LABELS: Record<string, string> = {
  analyze:   "Getting to know Quinta...",
  intents:   "Figuring out what hungry Londoners are searching for...",
  chatgpt:   "Checking if AI recommends you for pupusas in London...",
  claude:    "Searching for Quinta across AI dining guides...",
  gemini:    "Scanning AI recommendations for Central American food...",
  recommend: "Spotting where Quinta flies under the radar...",
  actions:   "Cooking up the action plan...",
};

const DEMO_PROFILE: BusinessProfile = {
  name: "Quinta",
  type: "Salvadoran Restaurant",
  location: "South Kensington, London",
  description: "Quinta is a Central American restaurant in London specialising in authentic pupusas and street food. Built on the motto 'real food, authentic flavours', they serve pupusas, tacos, burritos, quesadillas and cocktails — a guilt-free taste of El Salvador in the city.",
  services: ["Pupusas", "Tacos", "Burritos", "Quesadillas", "Nachos", "Cocktails & Beers", "Online ordering", "Table reservations", "Merchandise"],
  signals: {
    hasSchema: false, hasBlog: false, hasFAQ: false, hasMetaDescription: true,
    titleTag: "QUINTA — Pupusas",
    socialLinks: ["https://www.instagram.com/quintapupusas/"],
    hasMapsEmbed: false, hasGoogleBusinessProfile: true, gbpHasHours: true,
    gbpPhotoCount: 6, reviewCount: 48, reviewRating: 4.6,
  },
};

const DEMO_INTENTS = [
  "find authentic Central American food in London",
  "where to eat pupusas in London",
  "best Salvadoran restaurant near me",
  "guilt-free healthy street food London",
  "casual Latin American dining London",
  "pupusa restaurant with online ordering London",
  "best tacos and burritos in London",
  "affordable Central American food near South Kensington",
  "date night restaurant with unique cuisine London",
  "top new London restaurants for authentic Latin food",
  "Central American food for groups London",
  "healthy takeaway options London",
];

const DEMO_QUERIES = [
  "best place to eat pupusas in London",
  "authentic Central American restaurant London",
  "Salvadoran food London delivery",
  "guilt-free street food restaurants in London",
  "best tacos and burritos near South Kensington London",
  "unique London restaurants for Central American food",
  "casual Latin American dining near me London",
  "affordable pupusa restaurant London",
  "healthy takeaway Central American London",
  "top Central American food spots London",
  "group dining Central American food London",
  "best new Latin food restaurants London",
];

const DEMO_SCORE_RESULT: ScoreResult = {
  overallScore: 25,
  perLLM: [
    { llm: "openai",    score: 25, mentions: 3, totalQueries: 12 },
    { llm: "anthropic", score: 17, mentions: 2, totalQueries: 12 },
    { llm: "gemini",    score: 33, mentions: 4, totalQueries: 12 },
  ],
  intents: DEMO_INTENTS,
  queries: DEMO_QUERIES,
  debug: [
    { query: DEMO_QUERIES[0], llm: "openai",    response: "For pupusas in London, Quinta on Squarespace has been mentioned, along with a few other Latin American spots.", mentioned: true,  latencyMs: 1340 },
    { query: DEMO_QUERIES[0], llm: "anthropic", response: "London has a growing Central American food scene. Restaurants in Brixton and Hackney serve Salvadoran dishes.", mentioned: false, latencyMs: 2210 },
    { query: DEMO_QUERIES[0], llm: "gemini",    response: "Quinta is a Central American restaurant in London specialising in authentic pupusas.", mentioned: true,  latencyMs: 1080 },
    { query: DEMO_QUERIES[1], llm: "openai",    response: "Authentic Central American restaurants in London include a handful of spots in West and South London.", mentioned: false, latencyMs: 1150 },
    { query: DEMO_QUERIES[1], llm: "anthropic", response: "Central American cuisine in London is underrepresented. A few pop-ups and small restaurants serve Salvadoran and Guatemalan food.", mentioned: false, latencyMs: 1990 },
    { query: DEMO_QUERIES[1], llm: "gemini",    response: "Quinta is one of the few dedicated Salvadoran restaurants in London, serving pupusas and street food.", mentioned: true,  latencyMs: 1010 },
    { query: DEMO_QUERIES[2], llm: "openai",    response: "For Salvadoran food delivery in London, options are limited — some Latin American restaurants offer similar dishes.", mentioned: false, latencyMs: 1280 },
    { query: DEMO_QUERIES[2], llm: "anthropic", response: "Salvadoran delivery options in London are sparse. Deliveroo and Uber Eats carry a few Latin American restaurants.", mentioned: false, latencyMs: 2050 },
    { query: DEMO_QUERIES[2], llm: "gemini",    response: "Quinta offers online ordering for their Central American menu including pupusas and tacos.", mentioned: true,  latencyMs: 980  },
    { query: DEMO_QUERIES[3], llm: "openai",    response: "Guilt-free street food in London — try places like LEON, Farmer J, or some of the Borough Market stalls.", mentioned: false, latencyMs: 1200 },
    { query: DEMO_QUERIES[3], llm: "anthropic", response: "Healthy street food in London: LEON, Itsu, and various market stalls are popular choices.", mentioned: false, latencyMs: 1870 },
    { query: DEMO_QUERIES[3], llm: "gemini",    response: "For guilt-free street food, Quinta stands out with their 'get well fed, guilt free' ethos and fresh Central American dishes.", mentioned: true,  latencyMs: 1120 },
    { query: DEMO_QUERIES[4], llm: "openai",    response: "Best tacos near South Kensington: Tendido Cero and a few independent spots serve Latin American food in the area.", mentioned: false, latencyMs: 1310 },
    { query: DEMO_QUERIES[4], llm: "anthropic", response: "South Kensington has a varied dining scene — for tacos and burritos, Wahaca nearby and Quinta are worth considering.", mentioned: true,  latencyMs: 2100 },
    { query: DEMO_QUERIES[4], llm: "gemini",    response: "Near South Kensington for tacos and burritos, Quinta is one of the few spots specialising in Central American food.", mentioned: true,  latencyMs: 1040 },
    { query: DEMO_QUERIES[5], llm: "openai",    response: "Unique Central American restaurants in London — the scene is niche but growing, with a few spots in West and South London.", mentioned: true,  latencyMs: 1190 },
    { query: DEMO_QUERIES[5], llm: "anthropic", response: "For unique Central American food, there are very few dedicated restaurants. Most Latin American spots in London focus on Mexican or Brazilian cuisine.", mentioned: false, latencyMs: 1950 },
    { query: DEMO_QUERIES[5], llm: "gemini",    response: "Central American dining in London is rare — Quinta is one of the few restaurants dedicated to Salvadoran food and pupusas.", mentioned: true,  latencyMs: 1070 },
  ],
  summary: "Quinta surfaces in roughly a quarter of AI-generated responses about London dining, but almost exclusively when the query specifically mentions pupusas or Central American food. For broader searches — healthy street food, casual Latin dining, South Kensington restaurants — it rarely appears. Gemini is most likely to mention it; Claude almost never does. The core issue is thin indexed content: no blog, no FAQ, and absent Schema markup mean AI models have little to draw on beyond the homepage.",
};

const DEMO_BLOG_CONTENT = `# Day 1: What Makes a Perfect Pupusa? The Story Behind Quinta

Pupusas are one of Central America's best-kept culinary secrets — thick, handmade corn tortillas stuffed with savoury fillings and cooked on a flat comal until golden. At Quinta, they're the heart of everything we do.

## Where Pupusas Come From

The pupusa is the national dish of El Salvador, with roots stretching back over 2,000 years to indigenous Pipil communities. Traditionally made from masa (nixtamalised corn dough), they were cooked over open fires and shared communally — food as connection, not just fuel.

## What Goes Inside

At Quinta, we stuff our pupusas with combinations that balance tradition and freshness. Classic options include cheese and loroco (a Central American flower bud with a subtle, earthy flavour), chicharrón (slow-cooked pork), and refried beans. Each filling is chosen for how it complements the masa.

## The Art of the Comal

Getting the comal temperature right is everything. Too cool, and the masa goes soft and stodgy. Too hot, and the outside chars before the inside cooks through. Our kitchen team has years of practice reading the heat — it's the kind of thing that can't be rushed.

## Guilt-Free, Genuinely

Our motto — get well fed, guilt free — isn't a marketing line. Pupusas are naturally gluten-free, made from simple ingredients, and served with curtido (a lightly fermented cabbage slaw) that adds crunch and gut-friendly probiotics. Real food, done properly.

---

# Day 5: The Best Events to Experience Central American Culture in London

London has one of the most diverse cultural scenes in the world, and Central American culture is finally getting the spotlight it deserves. Whether you're curious about the food, the music, or the history, here's where to start.

## Festivals and Community Events

The Latin American community in London hosts regular cultural celebrations throughout the year. Carnaval del Pueblo, held in Burgess Park, is one of the largest Latin American festivals in Europe — a brilliant introduction to the music, dance, and food of the region, including Salvadoran and Guatemalan dishes you won't find anywhere else.

## Film and Art

The Instituto Cervantes in London regularly screens Central American cinema and hosts exhibitions exploring the region's art and history. It's a quieter, more intimate way to connect with the culture — and free for most events.

## The Best Way to Start: Eat the Food

If you want to understand a culture, start with its food. Pupusas aren't just a dish — they're a social ritual. In El Salvador, they're eaten on Sunday evenings with family, shared at markets, and made fresh at home. Coming to Quinta is a small window into that world.

## Plan Your Visit

Quinta is open for lunch and dinner. You can book a table online or walk in. Pair your meal with one of our Central American-inspired cocktails for the full experience.

---

# Day 10: From El Salvador to South Kensington: The Journey of the Pupusa

Every dish has a story. The pupusa's story stretches from pre-Columbian Mesoamerica to a small restaurant in London — and it's a story worth telling.

## Ancient Roots

Archaeological evidence suggests pupusas have been made in what is now El Salvador for over 2,000 years. The Pipil people, indigenous to the region, ground corn using a metate and shaped masa by hand. The comal — a flat clay or metal griddle — was their oven.

## National Identity

In 2005, El Salvador officially declared November 13th as National Pupusa Day. The dish is more than food: it's a symbol of resilience, community, and pride. Salvadorans living abroad carry the tradition with them — and that's how pupusas arrived in London.

## What Makes the London Version Different

At Quinta, we stay true to the original. We use masa harina, traditional fillings, and the same cooking technique passed down through generations. What's different is the setting: a London dining room where the dish can reach people who've never tasted Central American food before.

## Why It Matters

Food is one of the most direct ways to cross cultural boundaries. Every pupusa we serve is a small act of sharing — a dish that says: this is where we come from, and we're glad you're here.

---

# Day 15: Why Central American Street Food Is London's Best-Kept Secret

London's food scene gets a lot of attention — rightly so. But while Mexican, Peruvian, and Brazilian cuisines have found their footing, Central American food remains largely undiscovered. That's starting to change.

## The Gap in London's Food Map

Ask most Londoners to name a Central American restaurant and they'll struggle. Yet the flavours of El Salvador, Guatemala, Honduras, and Nicaragua are just as rich, just as nuanced, and just as worthy of a place in the city's food culture as any other regional cuisine.

## What Sets It Apart

Central American cooking is built on corn, beans, and slow preparation. It's not fusion food or trend-chasing — it's centuries-old technique applied to simple, high-quality ingredients. Pupusas, for instance, require no oven, no complex equipment, just a skilled pair of hands and good masa.

## Quinta's Role

Quinta opened to give Londoners a genuine point of entry into this cuisine. Not a watered-down version, not fusion — authentic flavours, made properly. The response has been stronger than expected, which tells you something about how ready London is for this food.

## Where to Start

Order the cheese and loroco pupusa. Loroco is a Central American flower bud with an earthy, slightly nutty flavour — you won't have tasted it before, and you'll want it again. Add curtido on the side and eat it the way it was meant to be eaten: hot, fresh, and shared.

---

# Day 22: Quinta's Guide to a Guilt-Free Night Out in London

Going out shouldn't mean paying for it the next day. Quinta was built around a simple idea: you can eat well, drink well, and still feel good about it. Here's how to do a Quinta night properly.

## Start with Cocktails

Our cocktail list draws on Central American ingredients — tropical fruits, herbs, and spirits that don't appear on many London menus. Start with something fresh and citrusy to open your appetite.

## Order to Share

The best way to eat at Quinta is to order several dishes between the table. Get a mix of pupusas — try at least one with loroco and cheese, one with chicharrón. Add nachos for the table, and a round of tacos if you're hungry.

## The Guilt-Free Part

Everything on our menu is made from fresh, simple ingredients. No hidden additives, no heavy processing. Pupusas are naturally gluten-free and filling without being heavy. You'll leave satisfied, not sluggish.

## End on Something Sweet

Our dessert menu is short but considered. Ask the team what's on that night — it changes with the season and what's come in fresh.

## Book or Walk In

We take reservations online and welcome walk-ins. Friday and Saturday evenings fill up quickly, so booking ahead is worth it if you have a specific time in mind.`;

const DEMO_FAQ_CONTENT = `Q1: What exactly is a pupusa?
A1: A pupusa is a thick, handmade corn tortilla stuffed with savoury fillings — cheese, beans, pork, or combinations of these — then cooked on a flat griddle called a comal. It's the national dish of El Salvador and the heart of our menu at Quinta.

Q2: Are pupusas gluten-free?
A2: Yes. Our pupusas are made from masa (nixtamalised corn dough), which is naturally gluten-free. If you have a gluten intolerance or coeliac disease, please let us know and we'll take extra care with preparation.

Q3: What other dishes do you serve at Quinta?
A3: Beyond pupusas, we serve tacos, burritos, quesadillas, nachos, starters, and desserts. Our drinks menu includes cocktails, beers, wine, and soft drinks. There's something for everyone.

Q4: Can I book a table at Quinta?
A4: Yes — reservations can be made through our website via the OrderTab booking system. Walk-ins are also welcome, subject to availability.

Q5: Do you offer online ordering or delivery?
A5: Yes, you can order online directly through our website. We also have delivery available through third-party platforms — check our site for current options.

Q6: Where is Quinta located?
A6: Quinta is in London. Full address and directions are available on our website and Google Business Profile.

Q7: Is the food at Quinta suitable for vegetarians?
A7: Yes, several of our dishes are vegetarian-friendly, including cheese and loroco pupusas, bean pupusas, and various sides. Please ask our team about specific options when you visit.

Q8: What does 'guilt-free' mean on your menu?
A8: It reflects our philosophy: fresh ingredients, nothing artificial, portions that satisfy without excess. Pupusas are naturally gluten-free and made simply — real food that happens to be good for you.

Q9: Do you cater for groups or private events?
A9: We can accommodate groups — get in touch via our contact page to discuss availability and any special requirements.

Q10: Do you have a loyalty programme or newsletter?
A10: You can sign up to our email newsletter on the website to hear about new openings, menu updates, and offers.`;

const DEMO_RECOMMENDATIONS: Recommendation[] = [
  {
    title: "Publish a blog or news section",
    whyItMatters: "Fresh, indexed content about pupusas and Central American food gives AI models something to cite. Businesses with active blogs are surfaced significantly more often in AI-generated local recommendations.",
    observed: "No blog or news section detected on the site.",
    impact: "High",
    firstAction: "Write 2–3 posts covering pupusa history, menu highlights, and London dining guides.",
  },
  {
    title: "Create a FAQ page",
    whyItMatters: "AI models use FAQ pages as a primary source when answering questions about local businesses. A well-structured FAQ about your food and booking process would directly increase citation frequency.",
    observed: "No FAQ page detected.",
    impact: "High",
    firstAction: "Add a dedicated FAQ page covering your most common customer questions.",
  },
  {
    title: "Add Schema.org markup",
    whyItMatters: "Without structured data, AI models struggle to extract accurate details about Quinta — location, cuisine type, hours, and menu. Schema markup is the single highest-impact technical fix for LLM visibility.",
    observed: "No JSON-LD schema detected on homepage.",
    impact: "High",
    firstAction: "Add a Restaurant JSON-LD snippet to your homepage <head>.",
  },
  {
    title: "Add more Google Business Profile photos",
    whyItMatters: "GBP listings with 10+ photos rank higher in local packs and are more likely to be referenced by AI models when describing local restaurants.",
    observed: "6 photos on GBP (target: 10+).",
    impact: "Medium",
    firstAction: "Upload at least 4 more photos: food close-ups, interior, drinks, and team.",
  },
];

const DEMO_ACTIONS: ActionCard[] = [
  {
    id: "blog", title: "Blog post draft", impact: "High",
    whyItMatters: "Publish this on your website to build content authority and increase AI citations for pupusa and Central American food queries in London.",
    content: DEMO_BLOG_CONTENT,
    contentType: "text",
  },
  {
    id: "faq", title: "FAQ page content", impact: "High",
    whyItMatters: "Add these Q&As to a dedicated FAQ page. AI models use FAQ pages as a primary source for factual answers about local restaurants.",
    content: DEMO_FAQ_CONTENT,
    contentType: "text",
  },
  {
    id: "schema", title: "Schema.org JSON-LD snippet", impact: "High",
    whyItMatters: "Paste this into your homepage <head> so AI models can reliably extract Quinta's details.",
    content: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Quinta",
  "url": "https://www.quintapupusas.com",
  "description": "Authentic Central American restaurant in London specialising in pupusas, tacos, burritos and street food. Real food, authentic flavours.",
  "servesCuisine": ["Salvadoran", "Central American", "Latin American"],
  "priceRange": "££",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "London",
    "addressCountry": "GB"
  },
  "sameAs": [
    "https://www.instagram.com/quintapupusas/"
  ],
  "menu": "https://www.quintapupusas.com/menu",
  "hasMap": "https://maps.google.com/?q=Quinta+Pupusas+London",
  "acceptsReservations": true
}
</script>`,
    contentType: "code",
  },
  {
    id: "gbp-photos", title: "GBP photo checklist", impact: "Medium",
    whyItMatters: "Upload at least 4 more photos to reach the 10-photo threshold that boosts local pack ranking and AI citations.",
    content: `Photos to upload to your Google Business Profile:

1. Hero food shot — a perfect pupusa, freshly off the comal
2. Interior — wide angle showing the dining space and atmosphere
3. Drinks — cocktail or beer with the food in the background
4. Kitchen / preparation — masa being shaped, comal in action
5. Team shot — welcoming, human, authentic
6. Curtido and sauces — the accompaniments that make the dish

Tips:
- Use natural light where possible; avoid flash
- Minimum 720px resolution, JPG or PNG
- Add a short keyword-rich caption to each photo in GBP
- Update photos seasonally to signal an active listing`,
    contentType: "steps",
  },
];

// ─── Fun loading step labels (adapt to business type) ─────────────────────────

// NOTE: no tool/product names here — purely business-context messages.
// To revert to generic labels, remove the call to getFunStepLabels in handleSubmit.
function getFunStepLabels(businessType: string): Partial<Record<string, string>> {
  const t = businessType.toLowerCase();
  if (/restaurant|café|cafe|bar|food|kitchen|bistro|diner|eatery|pizz|sushi|taco|pupusa|burrito|curry|takeaway|dining/.test(t)) {
    return {
      intents:   "Figuring out what hungry locals are searching for...",
      chatgpt:   "Checking if AI recommends you for local dining...",
      claude:    "Searching for you across AI food guides...",
      gemini:    "Scanning AI restaurant recommendations in your area...",
      recommend: "Spotting where you're missing the spotlight...",
      actions:   "Putting together your recipe for success...",
    };
  }
  if (/gym|fitness|personal train|yoga|pilates|crossfit|studio|health club/.test(t)) {
    return {
      intents:   "Figuring out what fitness seekers are searching for...",
      chatgpt:   "Checking if AI recommends you for local fitness...",
      claude:    "Searching for you across AI health guides...",
      gemini:    "Scanning AI fitness recommendations nearby...",
      recommend: "Identifying where you're benched...",
      actions:   "Building your training plan...",
    };
  }
  if (/salon|spa|beauty|hair|nail|barber|aesthet/.test(t)) {
    return {
      intents:   "Figuring out what beauty seekers are searching for...",
      chatgpt:   "Checking if AI recommends you for local beauty...",
      claude:    "Searching for you across AI lifestyle guides...",
      gemini:    "Scanning AI beauty recommendations nearby...",
      recommend: "Spotting where you need a touch-up...",
      actions:   "Putting together your glow-up plan...",
    };
  }
  return {
    intents:   "Figuring out what your customers are searching for...",
    chatgpt:   "Checking if AI recommends you in your category...",
    claude:    "Searching for you across AI guides...",
    gemini:    "Scanning AI recommendations in your area...",
    recommend: "Identifying your visibility gaps...",
    actions:   "Putting together your action plan...",
  };
}

// ─── Pipeline steps ───────────────────────────────────────────────────────────

type StepStatus = "pending" | "loading" | "done" | "error";
type PipelineStep = { id: string; label: string; status: StepStatus; error?: string };

const INITIAL_STEPS: PipelineStep[] = [
  { id: "analyze",   label: "Reading your website",             status: "pending" },
  { id: "intents",   label: "Analysing key customer intent",    status: "pending" },
  { id: "chatgpt",   label: "Calculating ChatGPT visibility",   status: "pending" },
  { id: "claude",    label: "Calculating Claude visibility",    status: "pending" },
  { id: "gemini",    label: "Calculating Gemini visibility",    status: "pending" },
  { id: "recommend", label: "Generating recommendations",       status: "pending" },
  { id: "actions",   label: "Suggesting relevant actions",      status: "pending" },
];

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "loading")
    return <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 border-[#1e2d4a] border-t-transparent animate-spin" />;
  if (status === "done")
    return (
      <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-emerald-600 flex items-center justify-center">
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 5l2.5 2.5L8 3" />
        </svg>
      </div>
    );
  if (status === "error")
    return (
      <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full bg-red-500 flex items-center justify-center">
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l4 4M7 3l-4 4" />
        </svg>
      </div>
    );
  return <div className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border-2 border-[#1e2d4a]/20" />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LLM_META: Record<LLMProvider, { label: string; color: string }> = {
  openai:    { label: "ChatGPT", color: "bg-emerald-500" },
  anthropic: { label: "Claude",  color: "bg-[#1e2d4a]"  },
  gemini:    { label: "Gemini",  color: "bg-sky-500"    },
};

function scoreLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "text-emerald-700" };
  if (score >= 60) return { label: "Good",      color: "text-sky-700"     };
  if (score >= 40) return { label: "Fair",       color: "text-amber-700"  };
  return { label: "Poor", color: "text-red-600" };
}

function ScoreBar({ label, score, color, mentions, total }: {
  label: string; score: number; color: string; mentions?: number; total?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-[#6b7a8d]">
        <span>{label}</span>
        <span className="font-medium text-[#1e2d4a]">
          {score}/100
          {mentions !== undefined && total !== undefined && (
            <span className="text-[#9aa3af] font-normal ml-1">({mentions}/{total})</span>
          )}
        </span>
      </div>
      <div className="h-1.5 bg-[#1e2d4a]/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

const IMPACT_STYLES: Record<RecommendationImpact, string> = {
  High:   "bg-red-100 text-red-700 border border-red-200",
  Medium: "bg-amber-100 text-amber-700 border border-amber-200",
  Low:    "bg-[#1e2d4a]/[0.06] text-[#6b7a8d] border border-[#1e2d4a]/15",
};

// ─── FAQ / Blog content parsers ───────────────────────────────────────────────

function parseFAQ(content: string): Array<{ title: string; body: string }> {
  // Format 1: LLM output — ### Question\nAnswer
  const h3Items: Array<{ title: string; body: string }> = [];
  const h3Regex = /###\s+(.+?)\n([\s\S]+?)(?=\n###\s|$)/g;
  let m;
  while ((m = h3Regex.exec(content)) !== null) {
    const body = m[2].trim();
    if (body) h3Items.push({ title: m[1].trim(), body });
  }
  if (h3Items.length > 0) return h3Items;

  // Format 2: demo data — Q1: Question\nA1: Answer
  const qaItems: Array<{ title: string; body: string }> = [];
  const qaRegex = /Q\d+:\s*(.+?)\nA\d+:\s*([\s\S]+?)(?=\n\nQ\d+:|$)/g;
  while ((m = qaRegex.exec(content)) !== null) {
    qaItems.push({ title: m[1].trim(), body: m[2].trim() });
  }
  if (qaItems.length > 0) return qaItems;

  return [{ title: "FAQ Content", body: content }];
}

function parseBlog(content: string): Array<{ title: string; body: string }> {
  const posts = content.split(/\n{2,}---\n{2,}/);
  if (posts.length > 1) {
    return posts.map((post) => {
      const firstLine = post.trim().split("\n")[0].replace(/^#+\s*/, "").trim();
      return { title: firstLine || "Blog Post", body: post.trim() };
    });
  }
  const firstLine = content.trim().split("\n")[0].replace(/^#+\s*/, "").trim();
  return [{ title: firstLine || "Blog Post", body: content }];
}

// ─── Accordion list (for FAQ / blog card backs) ───────────────────────────────

function AccordionTitle({ title }: { title: string }) {
  const match = title.match(/^(Day \d+:)\s*(.+)/);
  if (match) {
    return (
      <span className="text-sm font-medium text-[#1e2d4a] leading-snug pr-3">
        <span className="font-bold">{match[1]}</span> {match[2]}
      </span>
    );
  }
  return <span className="text-sm font-medium text-[#1e2d4a] leading-snug pr-3">{title}</span>;
}

function AccordionList({ items }: { items: Array<{ title: string; body: string }> }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  function copy(text: string, i: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(i);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  }

  return (
    <div className="space-y-1.5 overflow-y-auto flex-1 pr-0.5">
      {items.map((item, i) => (
        <div key={i} className="border border-[#1e2d4a]/12 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#1e2d4a]/[0.03] transition-colors"
          >
            <AccordionTitle title={item.title} />
            <span className="text-[#1e2d4a]/30 flex-shrink-0 text-xs">{openIndex === i ? "▲" : "▼"}</span>
          </button>
          {openIndex === i && (
            <div className="px-4 pb-4 pt-1 bg-[#1e2d4a]/[0.025] border-t border-[#1e2d4a]/10">
              <pre className="text-xs text-[#6b7a8d] whitespace-pre-wrap leading-relaxed font-sans max-h-44 overflow-y-auto">
                {item.body}
              </pre>
              <button
                onClick={() => copy(item.body, i)}
                className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-[#1e2d4a] text-white hover:bg-[#2c3e70] transition-colors"
              >
                {copiedIndex === i ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Lead Capture Modal ───────────────────────────────────────────────────────

function LeadCaptureModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="fixed inset-0 bg-[#1e2d4a]/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9aa3af] hover:text-[#1e2d4a] transition-colors text-lg leading-none"
        >
          ✕
        </button>

        {submitted ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-[#1e2d4a]" style={{ fontFamily: "var(--font-playfair)" }}>
              You&apos;re on the list.
            </h2>
            <p className="text-sm text-[#6b7a8d] leading-relaxed">
              We&apos;ll be in touch shortly to discuss how the NLM Marketing Agent can improve your AI visibility.
            </p>
            <button
              onClick={onClose}
              className="mt-2 text-xs text-[#9aa3af] hover:text-[#1e2d4a] transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9aa3af] mb-2">
                NLM
              </p>
              <h2 className="text-2xl font-bold text-[#1e2d4a] leading-snug" style={{ fontFamily: "var(--font-playfair)" }}>
                Let the agent do it for you.
              </h2>
              <p className="text-sm text-[#6b7a8d] leading-relaxed mt-3">
                The NLM Marketing Agent handles your AI visibility improvements end-to-end — from publishing blog posts to updating your Schema markup. Leave your email and we&apos;ll reach out.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-[#1e2d4a]/15 bg-[#ece8e1]/40 text-[#1e2d4a] placeholder-[#9aa3af] focus:outline-none focus:ring-2 focus:ring-[#1e2d4a]/25 text-sm"
              />
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#1e2d4a] text-white font-semibold text-sm hover:bg-[#2c3e70] transition-colors"
              >
                Get early access →
              </button>
            </form>
            <p className="text-xs text-[#9aa3af] text-center">
              No spam. We&apos;ll only use this to follow up about NLM.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Flip Card ────────────────────────────────────────────────────────────────

function ImprovementFlipCard({
  recommendation,
  action,
  isFlipped,
  onFlip,
  onHireAgent,
}: {
  recommendation: Recommendation;
  action?: ActionCard;
  isFlipped: boolean;
  onFlip: () => void;
  onHireAgent: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [copiedAll, setCopiedAll] = React.useState(false);

  const isFAQ  = action && (action.id === "faq" || action.id === "faq-draft" || /^Q1:\s/.test(action.content.trim()) || /^#[^\n]*\n[\s\S]*###/.test(action.content.trim()));
  const isBlog = action && (action.id === "blog" || action.id === "blog-post-intro" || /^#\s/.test(action.content.trim())) && !isFAQ;

  function handleCopyAllFAQ() {
    if (!action) return;
    const items = parseFAQ(action.content);
    const md = items.map((item) => `**Q: ${item.title}**\n\n${item.body}`).join("\n\n---\n\n");
    navigator.clipboard.writeText(md).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    });
  }

  const accordionItems = isFAQ
    ? parseFAQ(action!.content)
    : isBlog
    ? parseBlog(action!.content)
    : null;

  function handleCopy() {
    if (!action) return;
    navigator.clipboard.writeText(action.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flip-container w-full" style={{ height: "460px" }}>
      <div className={`flip-card-inner w-full h-full${isFlipped ? " is-flipped" : ""}`}>

        {/* ── Front: Problem ── */}
        <div className="flip-card-face flip-card-front bg-white border border-[#1e2d4a]/10 rounded-2xl p-6 flex flex-col shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-5">
            <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-semibold ${IMPACT_STYLES[recommendation.impact]}`}>
              {recommendation.impact} impact
            </span>
          </div>
          <h3 className="text-lg font-bold text-[#1e2d4a] leading-snug mb-4">
            {recommendation.title}
          </h3>
          <p className="text-sm text-[#6b7a8d] leading-relaxed mb-4">
            {recommendation.whyItMatters}
          </p>
          <div className="text-xs text-[#9aa3af] bg-[#1e2d4a]/[0.04] rounded-xl px-4 py-3 leading-relaxed">
            <span className="text-[#6b7a8d] font-medium">Observed: </span>
            {recommendation.observed}
          </div>
          <div className="flex-1" />
          <button
            onClick={onFlip}
            className="mt-6 w-full py-3 rounded-xl bg-[#1e2d4a] text-white font-semibold text-sm hover:bg-[#2c3e70] transition-colors"
          >
            What to do next →
          </button>
        </div>

        {/* ── Back: Action ── */}
        <div className="flip-card-face flip-card-back bg-white border border-[#1e2d4a]/15 rounded-2xl p-6 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#1e2d4a]">
              Action plan
            </p>
            <button
              onClick={onFlip}
              className="text-xs text-[#9aa3af] hover:text-[#1e2d4a] transition-colors"
            >
              ← Back
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {action ? (
              accordionItems ? (
                /* FAQ or Blog: accordion */
                <>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-xs text-[#6b7a8d] leading-relaxed">{action.whyItMatters}</p>
                    {isFAQ && (
                      <button
                        onClick={handleCopyAllFAQ}
                        className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[#1e2d4a]/15 text-[#6b7a8d] hover:bg-[#1e2d4a]/[0.04] transition-colors"
                      >
                        {copiedAll ? "Copied!" : "Copy FAQ as Markdown"}
                      </button>
                    )}
                  </div>
                  <AccordionList items={accordionItems} />
                  {action.isPlaceholder && (
                    <p className="text-xs text-amber-600/70 mt-2 italic">Template — customise before using.</p>
                  )}
                </>
              ) : (
                /* Code or plain text */
                <>
                  <p className="text-xs text-[#6b7a8d] leading-relaxed mb-3">{action.whyItMatters}</p>
                  <div className="relative rounded-xl overflow-hidden">
                    <pre className={`text-xs px-4 py-4 overflow-auto whitespace-pre-wrap leading-relaxed max-h-48 ${
                      action.contentType === "code"
                        ? "bg-[#1a1f2e] text-gray-300 font-mono"
                        : "bg-[#1e2d4a]/[0.04] text-[#1e2d4a]/80"
                    }`}>
                      {action.content}
                    </pre>
                    <button
                      onClick={handleCopy}
                      className="absolute top-3 right-3 text-xs px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-gray-300 hover:text-white transition-colors border border-white/10"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  {action.isPlaceholder && (
                    <p className="text-xs text-amber-600/70 mt-2 italic">Template — customise before using.</p>
                  )}
                </>
              )
            ) : (
              /* No action yet: show firstAction text */
              <div className="bg-[#1e2d4a]/[0.04] rounded-xl px-4 py-4">
                <p className="text-sm text-[#1e2d4a]/70 leading-relaxed">{recommendation.firstAction}</p>
              </div>
            )}
          </div>

          {/* CTA — always pinned at the bottom */}
          <div className="pt-3 mt-3 border-t border-[#1e2d4a]/[0.08] flex-shrink-0">
            <button
              onClick={onHireAgent}
              className="w-full py-2.5 rounded-xl bg-[#1e2d4a] text-white font-semibold text-xs hover:bg-[#2c3e70] active:scale-[0.98] transition-all tracking-wide"
            >
              Hire the NLM Marketing Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [showModal, setShowModal] = useState(false);
  const intentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [demoMode, setDemoMode] = useState(false);


  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState(false);
  const [actions, setActions] = useState<ActionCard[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [testingMode, setTestingMode] = useState<TestingMode>("all");
  const [queryCount, setQueryCount] = useState(12);

  // UI state
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [profileCollapsed, setProfileCollapsed] = useState(true);
  const [descExpanded, setDescExpanded] = useState(false);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [signalsExpanded, setSignalsExpanded] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const carouselRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(0);

  const runScore = testingMode === "all" || testingMode === "score-only";
  const runRecommendations = testingMode === "all" || testingMode === "rec-only";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDemoMode(params.has("demo"));
    setDevMode(params.has("dev"));
  }, []);

  useEffect(() => {
    if (!carouselRef.current) return;
    const obs = new ResizeObserver(([entry]) => setCardWidth(entry.contentRect.width * 0.88));
    obs.observe(carouselRef.current);
    return () => obs.disconnect();
  }, [submitted, recommendations.length]);

  useEffect(() => {
    if (showModal && steps.every((s) => s.status === "done")) {
      const t = setTimeout(() => setShowModal(false), 800);
      return () => clearTimeout(t);
    }
  }, [steps, showModal]);

  const setStep = (id: string, update: Partial<PipelineStep>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));

  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function flipCard(i: number) {
    setFlippedCards((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  function resetState() {
    setSubmitted(false);
    setProfile(null);
    setScoreResult(null);
    setError(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setShowModal(false);
    setRecommendations([]);
    setRecommendationsLoading(false);
    setRecommendationsError(false);
    setActions([]);
    setActionsLoading(false);
    setCarouselIndex(0);
    setFlippedCards(new Set());
    setProfileCollapsed(true);
    setDescExpanded(false);
    setServicesExpanded(false);
    setSignalsExpanded(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    if (testingMode === "fake") {
      setSubmitted(true);
      setProfile(FAKE_PROFILE);
      setScoreResult(FAKE_SCORE_RESULT);
      setRecommendations(FAKE_RECOMMENDATIONS);
      setActions(FAKE_ACTIONS);
      return;
    }

    if (demoMode) {
      setSubmitted(true);
      const advance = (id: string, s: StepStatus) =>
        setSteps((prev) => prev.map((p) => (p.id === id ? { ...p, status: s } : p)));
      const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const demoSteps: PipelineStep[] = Object.entries(DEMO_STEP_LABELS).map(([id, label]) => ({
        id, label, status: "pending" as StepStatus,
      }));
      setSteps(demoSteps);
      setShowModal(true);
      advance("analyze",   "loading");
      await wait(800);  advance("analyze",   "done"); advance("intents",   "loading");
      await wait(900);  advance("intents",   "done"); advance("chatgpt",   "loading");
      await wait(1400); advance("chatgpt",   "done"); advance("claude",    "loading");
      await wait(1300); advance("claude",    "done"); advance("gemini",    "loading");
      await wait(1100); advance("gemini",    "done"); advance("recommend", "loading");
      await wait(700);  advance("recommend", "done"); advance("actions",   "loading");
      await wait(800);  advance("actions",   "done");
      await wait(300);
      setProfile(DEMO_PROFILE);
      setScoreResult(DEMO_SCORE_RESULT);
      setRecommendations(DEMO_RECOMMENDATIONS);
      setActions(DEMO_ACTIONS);
      setShowModal(false);
      return;
    }

    if (intentTimeoutRef.current) clearTimeout(intentTimeoutRef.current);
    setSubmitted(true);
    setProfile(null);
    setScoreResult(null);
    setError(null);
    setDebugOpen(false);
    setExpandedRows(new Set());
    setRecommendations([]);
    setRecommendationsLoading(false);
    setRecommendationsError(false);
    setActions([]);
    setActionsLoading(false);
    setCarouselIndex(0);
    setFlippedCards(new Set());

    const activeSteps: PipelineStep[] = [
      { id: "analyze",   label: "Reading your website",             status: "pending" },
      ...(runScore ? [
        { id: "intents",   label: "Analysing key customer intent",   status: "pending" as StepStatus },
        { id: "chatgpt",   label: "Calculating ChatGPT visibility",  status: "pending" as StepStatus },
        { id: "claude",    label: "Calculating Claude visibility",   status: "pending" as StepStatus },
        { id: "gemini",    label: "Calculating Gemini visibility",   status: "pending" as StepStatus },
      ] : []),
      ...(runRecommendations ? [
        { id: "recommend", label: "Generating recommendations",      status: "pending" as StepStatus },
        { id: "actions",   label: "Suggesting relevant actions",     status: "pending" as StepStatus },
      ] : []),
    ];
    setSteps(activeSteps);
    setShowModal(true);

    setStep("analyze", { status: "loading" });
    let fetchedProfile: BusinessProfile;
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json"))
        throw new Error(`Server error (${res.status}) — check your .env.local API keys`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      fetchedProfile = data.profile;
      setProfile(fetchedProfile);
      setStep("analyze", { status: "done" });
      const funLabels = getFunStepLabels(fetchedProfile.type);
      setSteps((prev) => prev.map((s) => funLabels[s.id] ? { ...s, label: funLabels[s.id]! } : s));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setStep("analyze", { status: "error", error: msg });
      setError(msg);
      return;
    }

    if (runRecommendations) {
      setStep("recommend", { status: "loading" });
      setRecommendationsLoading(true);
      fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: fetchedProfile }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.recommendations) setRecommendations(d.recommendations);
          setStep("recommend", { status: "done" });
        })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : "Recommendations failed";
          setStep("recommend", { status: "error", error: msg });
          setRecommendationsError(true);
        })
        .finally(() => setRecommendationsLoading(false));

      setStep("actions", { status: "loading" });
      setActionsLoading(true);
      fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: fetchedProfile, url }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.actions) setActions(d.actions); setStep("actions", { status: "done" }); })
        .catch(() => setStep("actions", { status: "error" }))
        .finally(() => setActionsLoading(false));
    }

    if (runScore) {
      setStep("intents", { status: "loading" });
      intentTimeoutRef.current = setTimeout(() => {
        setStep("intents", { status: "done" });
        setStep("chatgpt", { status: "loading" });
        setStep("claude",  { status: "loading" });
        setStep("gemini",  { status: "loading" });
      }, 3000);
      try {
        const res = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, profile: fetchedProfile, queryCount }),
        });
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json"))
          throw new Error(`Scoring error (${res.status}) — check your API keys`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Scoring failed");
        if (intentTimeoutRef.current) clearTimeout(intentTimeoutRef.current);
        setStep("intents", { status: "done" });
        setStep("chatgpt", { status: "done" });
        setStep("claude",  { status: "done" });
        setStep("gemini",  { status: "done" });
        setScoreResult(data);
      } catch (err) {
        if (intentTimeoutRef.current) clearTimeout(intentTimeoutRef.current);
        const msg = err instanceof Error ? err.message : "Scoring failed";
        setStep("intents", { status: "error", error: msg });
        setStep("chatgpt", { status: "error" });
        setStep("claude",  { status: "error" });
        setStep("gemini",  { status: "error" });
        setError(msg);
      }
    }
  }

  const hasStepError = steps.some((s) => s.status === "error");
  const isRunning    = steps.some((s) => s.status === "loading");

  const improvements = recommendations.map((rec, i) => ({ recommendation: rec, action: actions[i] }));
  const totalCards = improvements.length;

  return (
    <main className="min-h-screen bg-[#ece8e1] text-[#1e2d4a] flex flex-col">

      {/* Lead capture modal */}
      {showLeadModal && <LeadCaptureModal onClose={() => setShowLeadModal(false)} />}

      {/* Progress modal */}
      {showModal && (
        <div className="fixed inset-0 bg-[#1e2d4a]/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white border border-[#1e2d4a]/10 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-[#1e2d4a]">Analysing your business</h2>
              <p className="text-xs text-[#9aa3af] mt-0.5 break-all">{url}</p>
            </div>
            <ul className="space-y-3">
              {steps.map((step) => (
                <li key={step.id} className="flex items-center gap-3">
                  <StepIcon status={step.status} />
                  <div className="min-w-0">
                    {step.status === "pending" ? (
                      <span className="block h-2 w-28 rounded bg-[#1e2d4a]/10" />
                    ) : (
                      <span className={`text-sm ${step.status === "error" ? "text-red-600" : "text-[#1e2d4a]"}`}>
                        {step.label}
                      </span>
                    )}
                    {step.error && (
                      <p className="text-xs text-red-500 mt-1 font-mono break-words">{step.error}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {hasStepError && !isRunning && (
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2 text-sm text-[#6b7a8d] border border-[#1e2d4a]/10 rounded-xl hover:bg-[#1e2d4a]/[0.04] transition-colors"
              >Close</button>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col items-center px-4 py-20">
        <div className="max-w-xl w-full text-center space-y-6">

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6b7a8d]">
            Translating your business value into AI visibility
          </p>

          <h1 className="text-5xl font-bold text-[#1e2d4a] leading-tight" style={{ fontFamily: "var(--font-playfair)" }}>
            AI is recommending businesses. Is yours one of them?
          </h1>

          <p className="text-[#6b7a8d] text-lg leading-relaxed">
            Enter your website URL and we&apos;ll analyze how visible and accurately
            represented your business is across leading AI models, then suggest how to improve it.
          </p>

          {/* ── Pre-submit ── */}
          {!submitted ? (
            <>
              <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://yourbusiness.com"
                    required
                    className="flex-1 px-4 py-3 rounded-xl border border-[#1e2d4a]/15 bg-white text-[#1e2d4a] placeholder-[#9aa3af] focus:outline-none focus:ring-2 focus:ring-[#1e2d4a]/30 text-sm shadow-sm"
                  />
                  <button
                    type="submit"
                    className="px-6 py-3 bg-[#1e2d4a] text-white rounded-xl font-semibold text-sm hover:bg-[#2c3e70] transition-colors whitespace-nowrap shadow-sm"
                  >
                    Analyze →
                  </button>
                </div>
                {devMode && (
                  <div className="flex items-center gap-3 px-1 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9aa3af] whitespace-nowrap">Testing mode</span>
                      <select
                        value={testingMode}
                        onChange={(e) => setTestingMode(e.target.value as TestingMode)}
                        className="text-xs border border-[#1e2d4a]/15 rounded-lg px-2 py-1.5 text-[#6b7a8d] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e2d4a]/20"
                      >
                        <option value="all">All</option>
                        <option value="score-only">LLM Score Only</option>
                        <option value="rec-only">Recommendations + Actions Only</option>
                        <option value="fake">Fake Data</option>
                      </select>
                    </div>
                    {(testingMode === "all" || testingMode === "score-only") && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#9aa3af] whitespace-nowrap">Queries per LLM</span>
                        <input
                          type="number" min={1} max={12} value={queryCount}
                          onChange={(e) => setQueryCount(Math.min(12, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="w-16 text-xs border border-[#1e2d4a]/15 rounded-lg px-2 py-1.5 text-center text-[#6b7a8d] bg-white focus:outline-none focus:ring-2 focus:ring-[#1e2d4a]/20"
                        />
                      </div>
                    )}
                  </div>
                )}
              </form>

              {/* Analyze, Measure, Improve */}
              <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
                {[
                  { step: "01", title: "Analyze", desc: "We examine your website to understand your business, products, and positioning." },
                  { step: "02", title: "Measure",  desc: "We query multiple LLMs to see how, and if, they mention your business." },
                  { step: "03", title: "Improve",  desc: "We deliver tailored recommendations to boost your AI visibility." },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="space-y-2">
                    <span className="text-xs font-mono text-[#1e2d4a]/40">{step}</span>
                    <h3 className="font-semibold text-[#1e2d4a]">{title}</h3>
                    <p className="text-sm text-[#6b7a8d]">{desc}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (

            /* ── Post-submit ── */
            <div className="mt-8 space-y-4 text-left">

              {/* URL chip */}
              <div className="px-4 py-3 rounded-xl border border-[#1e2d4a]/10 bg-white/60 flex items-center gap-3 shadow-sm">
                <span className="text-[#1e2d4a]/40 text-base">🔗</span>
                <p className="text-sm text-[#1e2d4a] break-all flex-1">{url}</p>
                <button onClick={resetState} className="text-xs text-[#9aa3af] hover:text-[#1e2d4a] whitespace-nowrap transition-colors">
                  Change
                </button>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* ── Your Business ── */}
              {profile && (
                <div className="rounded-2xl border border-[#1e2d4a]/10 bg-white overflow-hidden shadow-sm">
                  {/* Always-visible header */}
                  <div className="px-6 pt-5 pb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9aa3af] mb-3">
                      Your Business
                    </p>
                    <h2 className="text-xl font-bold text-[#1e2d4a] leading-tight mb-1">
                      {profile.name}
                    </h2>
                    {(profile.type || profile.location) && (
                      <p className="text-sm text-[#6b7a8d] mb-3">
                        {[profile.type, profile.location].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {/* Description with expand */}
                    <p className={`text-sm text-[#1e2d4a]/60 leading-relaxed${!descExpanded ? " line-clamp-1" : ""}`}>
                      {profile.description}
                    </p>
                    {profile.description.length > 80 && (
                      <button
                        onClick={() => setDescExpanded((v) => !v)}
                        className="text-xs text-[#1e2d4a]/50 hover:text-[#1e2d4a] mt-1 transition-colors"
                      >
                        {descExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>

                  {/* Toggle for services + signals */}
                  <button
                    onClick={() => setProfileCollapsed((c) => !c)}
                    className="w-full px-6 py-2.5 flex items-center gap-2 border-t border-[#1e2d4a]/[0.06] bg-[#1e2d4a]/[0.02] hover:bg-[#1e2d4a]/[0.04] transition-colors"
                  >
                    <span className="text-xs text-[#9aa3af]">
                      {profileCollapsed ? "▼ Show services & signals" : "▲ Hide details"}
                    </span>
                  </button>

                  {!profileCollapsed && (
                    <div className="border-t border-[#1e2d4a]/[0.06]">
                      {profile.services.length > 0 && (
                        <div className="px-6 py-4 border-b border-[#1e2d4a]/[0.06]">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af] mb-3">Services</p>
                          <div className="flex flex-wrap gap-2">
                            {(servicesExpanded ? profile.services : profile.services.slice(0, 4)).map((s) => (
                              <span key={s} className="text-xs bg-[#1e2d4a]/[0.06] text-[#1e2d4a] px-3 py-1.5 rounded-lg">
                                {s}
                              </span>
                            ))}
                            {!servicesExpanded && profile.services.length > 4 && (
                              <button onClick={() => setServicesExpanded(true)} className="text-xs text-[#6b7a8d] hover:text-[#1e2d4a] px-2 py-1.5 transition-colors">
                                +{profile.services.length - 4} more
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="px-6 py-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af] mb-3">Signals detected</p>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const allSignals = [
                              { label: "Title tag",              active: !!profile.signals.titleTag },
                              { label: "Meta description",       active: profile.signals.hasMetaDescription },
                              { label: "Schema markup",          active: profile.signals.hasSchema },
                              { label: "Blog / News",            active: profile.signals.hasBlog },
                              { label: "FAQ page",               active: profile.signals.hasFAQ },
                              { label: "Social links",           active: profile.signals.socialLinks.length > 0 },
                              { label: "Google Maps embed",      active: profile.signals.hasMapsEmbed },
                              { label: "Google Business Profile", active: profile.signals.hasGoogleBusinessProfile },
                              ...(profile.signals.hasGoogleBusinessProfile ? [
                                { label: "GBP hours set",        active: profile.signals.gbpHasHours },
                                { label: `GBP photos (${profile.signals.gbpPhotoCount ?? 0})`, active: (profile.signals.gbpPhotoCount ?? 0) >= 10 },
                              ] : []),
                            ];
                            const visible = signalsExpanded ? allSignals : allSignals.slice(0, 5);
                            return (
                              <>
                                {visible.map(({ label, active }) => (
                                  <span key={label} className={`text-xs px-2.5 py-1.5 rounded-lg font-medium ${
                                    active ? "bg-emerald-100 text-emerald-700" : "bg-[#1e2d4a]/[0.04] text-[#9aa3af]"
                                  }`}>
                                    {active ? "✓" : "✗"} {label}
                                  </span>
                                ))}
                                {!signalsExpanded && allSignals.length > 5 && (
                                  <button onClick={() => setSignalsExpanded(true)} className="text-xs text-[#6b7a8d] hover:text-[#1e2d4a] px-2 py-1.5 transition-colors">
                                    +{allSignals.length - 5} more
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── AI Visibility Score — two column ── */}
              {scoreResult && (
                <div className="rounded-2xl border border-[#1e2d4a]/10 bg-white overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-[#1e2d4a]/[0.06] flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af]">AI Visibility Score</p>
                    <p className="text-xs text-[#9aa3af]">{scoreResult.queries.length} queries · 3 AI models</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 sm:divide-x divide-[#1e2d4a]/[0.06]">
                    <div className="px-6 py-5 space-y-5">
                      <div className="flex items-end gap-3">
                        <p className="text-5xl font-bold text-[#1e2d4a] leading-none">{scoreResult.overallScore}</p>
                        <div className="pb-1">
                          <span className="text-[#9aa3af] text-sm">/100</span>
                          <p className={`text-xs font-semibold ${scoreLabel(scoreResult.overallScore).color}`}>
                            {scoreLabel(scoreResult.overallScore).label}
                          </p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-[#1e2d4a]/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#1e2d4a] transition-all duration-700" style={{ width: `${scoreResult.overallScore}%` }} />
                      </div>
                      <div className="space-y-3 pt-1">
                        {scoreResult.perLLM.map((s) => {
                          const meta = LLM_META[s.llm];
                          return <ScoreBar key={s.llm} label={meta.label} score={s.score} color={meta.color} mentions={s.mentions} total={s.totalQueries} />;
                        })}
                      </div>
                    </div>
                    <div className="px-6 py-5 border-t sm:border-t-0 border-[#1e2d4a]/[0.06]">
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af] mb-3">What this means</p>
                      {scoreResult.summary
                        ? <p className="text-sm text-[#6b7a8d] leading-relaxed">{scoreResult.summary}</p>
                        : <p className="text-sm text-[#9aa3af] italic">No summary available.</p>}
                    </div>
                  </div>

                  {/* Full-width CTA row */}
                  <div className="px-6 py-5 border-t border-[#1e2d4a]/[0.06] space-y-3">
                    <p className="text-sm text-[#1e2d4a] font-medium leading-snug text-center">
                      Use NLM&apos;s agent to continuously improve your LLM presence.
                    </p>
                    <button
                      onClick={() => setShowLeadModal(true)}
                      className="w-full py-2.5 rounded-xl bg-[#1e2d4a] text-white font-semibold text-xs hover:bg-[#2c3e70] active:scale-[0.98] transition-all tracking-wide"
                    >
                      Hire the NLM Marketing Agent
                    </button>
                  </div>
                </div>
              )}

              {/* ── Recommended Improvements carousel ── */}
              {profile && (
                recommendationsError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3">
                    <p className="text-xs text-red-500">Could not generate recommendations, check your OPENAI_API_KEY.</p>
                  </div>
                ) : (recommendationsLoading || improvements.length > 0) && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af]">Recommended Improvements</p>
                        {!recommendationsLoading && improvements.length > 0 && (
                          <p className="text-xs text-[#9aa3af] mt-0.5">
                            {actionsLoading ? "Generating action plans..." : "Flip a card to see the action plan"}
                          </p>
                        )}
                      </div>
                      {(recommendationsLoading || actionsLoading) && (
                        <div className="flex items-center gap-1.5 text-xs text-[#9aa3af]">
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-[#1e2d4a]/20 border-t-[#1e2d4a] animate-spin" />
                          {recommendationsLoading ? "Analysing gaps..." : "Generating..."}
                        </div>
                      )}
                    </div>

                    {improvements.length > 0 && (
                      <>
                        {/* Carousel with arrows */}
                        <div className="relative">
                          {/* Prev arrow */}
                          {carouselIndex > 0 && (
                            <button
                              onClick={() => setCarouselIndex((i) => i - 1)}
                              className="absolute left-0 z-10 top-[220px] -translate-y-1/2 -translate-x-3 w-9 h-9 rounded-full bg-white border border-[#1e2d4a]/15 shadow-md flex items-center justify-center hover:bg-[#1e2d4a] hover:text-white text-[#1e2d4a] transition-colors text-sm font-medium"
                            >
                              ‹
                            </button>
                          )}

                          <div ref={carouselRef} className="overflow-hidden w-full">
                            <div
                              className="flex transition-transform duration-300 ease-in-out"
                              style={{
                                transform: cardWidth > 0 ? `translateX(-${carouselIndex * (cardWidth + 16)}px)` : "none",
                              }}
                            >
                              {improvements.map((item, i) => (
                                <div
                                  key={i}
                                  style={{ width: cardWidth > 0 ? `${cardWidth}px` : "88%", flexShrink: 0, marginRight: "16px" }}
                                >
                                  <ImprovementFlipCard
                                    recommendation={item.recommendation}
                                    action={item.action}
                                    isFlipped={flippedCards.has(i)}
                                    onFlip={() => flipCard(i)}
                                    onHireAgent={() => setShowLeadModal(true)}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Next arrow */}
                          {carouselIndex < totalCards - 1 && (
                            <button
                              onClick={() => setCarouselIndex((i) => i + 1)}
                              className="absolute right-0 z-10 top-[220px] -translate-y-1/2 translate-x-3 w-9 h-9 rounded-full bg-white border border-[#1e2d4a]/15 shadow-md flex items-center justify-center hover:bg-[#1e2d4a] hover:text-white text-[#1e2d4a] transition-colors text-sm font-medium"
                            >
                              ›
                            </button>
                          )}
                        </div>

                        {/* Dots */}
                        {totalCards > 1 && (
                          <div className="flex items-center justify-center gap-2 pt-1">
                            {improvements.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setCarouselIndex(i)}
                                className={`rounded-full transition-all duration-200 ${
                                  i === carouselIndex
                                    ? "bg-[#1e2d4a] w-5 h-2"
                                    : "bg-[#1e2d4a]/20 hover:bg-[#1e2d4a]/40 w-2 h-2"
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              )}

              {/* ── Debug panel ── */}
              {devMode && scoreResult && (
                <div className="rounded-2xl border border-[#1e2d4a]/10 overflow-hidden shadow-sm">
                  <button
                    onClick={() => setDebugOpen((o) => !o)}
                    className="w-full px-6 py-3 flex items-center justify-between bg-[#1e2d4a]/[0.03] hover:bg-[#1e2d4a]/[0.05] transition-colors"
                  >
                    <span className="text-xs font-mono text-[#9aa3af] uppercase tracking-widest">
                      Debug, Query x LLM Results
                    </span>
                    <span className="text-xs text-[#9aa3af]">{debugOpen ? "▲ hide" : "▼ show"}</span>
                  </button>

                  {debugOpen && (
                    <div className="overflow-x-auto bg-white">
                      <div className="px-6 py-4 border-b border-[#1e2d4a]/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af] mb-2">Common Customer Intents</p>
                          <ol className="space-y-1">
                            {scoreResult.intents.map((intent, i) => (
                              <li key={i} className="text-xs text-[#6b7a8d]">
                                <span className="font-mono text-[#9aa3af] mr-2">{String(i + 1).padStart(2, "0")}</span>{intent}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#9aa3af] mb-2">Generated Queries</p>
                          <ol className="space-y-1">
                            {scoreResult.queries.map((q, i) => (
                              <li key={i} className="text-xs text-[#1e2d4a]/70">
                                <span className="font-mono text-[#9aa3af] mr-2">{String(i + 1).padStart(2, "0")}</span>{q}
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#1e2d4a]/[0.03] border-b border-[#1e2d4a]/[0.06]">
                            <th className="text-left px-4 py-2 text-[#9aa3af] font-medium w-1/2">Query</th>
                            <th className="text-left px-4 py-2 text-[#9aa3af] font-medium">LLM</th>
                            <th className="text-left px-4 py-2 text-[#9aa3af] font-medium">Mentioned</th>
                            <th className="text-left px-4 py-2 text-[#9aa3af] font-medium">Latency</th>
                            <th className="px-4 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {scoreResult.debug.map((entry, i) => {
                            const rowKey = `${i}-${entry.llm}`;
                            const isExpanded = expandedRows.has(rowKey);
                            const meta = LLM_META[entry.llm];
                            return (
                              <React.Fragment key={rowKey}>
                                <tr
                                  className="border-b border-[#1e2d4a]/[0.05] hover:bg-[#1e2d4a]/[0.02] cursor-pointer"
                                  onClick={() => toggleRow(rowKey)}
                                >
                                  <td className="px-4 py-2 text-[#6b7a8d] max-w-xs truncate">{entry.query}</td>
                                  <td className="px-4 py-2 text-[#6b7a8d]">{meta.label}</td>
                                  <td className="px-4 py-2">
                                    {entry.error ? (
                                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">error</span>
                                    ) : entry.mentioned ? (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">yes</span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 rounded bg-[#1e2d4a]/[0.05] text-[#9aa3af]">no</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-[#9aa3af] font-mono">
                                    {entry.error ? "—" : entry.latencyMs > 0 ? `${(entry.latencyMs / 1000).toFixed(1)}s` : "—"}
                                  </td>
                                  <td className="px-4 py-2 text-[#9aa3af]">{isExpanded ? "▲" : "▼"}</td>
                                </tr>
                                {isExpanded && (
                                  <tr className="bg-[#1e2d4a]/[0.02] border-b border-[#1e2d4a]/[0.05]">
                                    <td colSpan={5} className="px-4 py-3 leading-relaxed whitespace-pre-wrap">
                                      {entry.error
                                        ? <span className="text-red-500 font-mono text-xs">{entry.errorMessage ?? "Unknown error"}</span>
                                        : <span className="text-[#6b7a8d] text-xs">{entry.response || <span className="italic">No response</span>}</span>}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </main>
  );
}
