require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const PASSWORD = process.env.DEMO_PASSWORD || "Demo@1234";

// tier, label, price multiplier
const TIERS = [
  ["BASIC", "Basic", 1],
  ["STANDARD", "Standard", 1.6],
  ["PREMIUM", "Premium", 2.4],
];

const sellers = [
  {
    key: "lahore-grand-caterers", business: "Lahore Grand Caterers", owner: "Imran Siddiqui",
    city: "Lahore", category: "catering", verified: true, years: 12,
    about: "Wedding and corporate buffets with traditional Pakistani and continental menus.",
    title: "Wedding Buffet Catering", price: 1800, pricingType: "per_person",
    features: "Per-person pricing, tasting session, trained service staff",
    inc: [
      "Buffet with 3 main dishes, rice, salad and 2 desserts",
      "Buffet with 5 main dishes, live BBQ counter and dessert bar",
      "Deluxe menu, live counters, service staff and full table setup",
    ],
  },
  {
    key: "peshawar-bloom-decor", business: "Peshawar Bloom Decor", owner: "Sana Gul",
    city: "Peshawar", category: "decoration", verified: false, years: 6,
    about: "Stage, floral and hall decoration for weddings and family events.",
    title: "Wedding Stage and Hall Decoration", price: 60000, pricingType: "fixed",
    features: "Fresh and artificial flowers, setup and cleanup included",
    inc: [
      "Stage backdrop and entrance floral arch",
      "Stage, entrance and table centerpieces",
      "Full hall decoration with drapes, lighting and floral walkway",
    ],
  },
  {
    key: "lumina-lighting", business: "Lumina Lighting", owner: "Bilal Raza",
    city: "Islamabad", category: "lighting", verified: true, years: 8,
    about: "Stage, ambient and architectural lighting for events of all sizes.",
    title: "Event Lighting Package", price: 35000, pricingType: "fixed",
    features: "LED wash lights, moving heads, technician on site",
    inc: [
      "Basic LED wash lighting for one stage",
      "Stage lighting, ambient hall lighting and 2 moving heads",
      "Full show lighting, truss rigging and lighting operator",
    ],
  },
  {
    key: "soundwave-pro", business: "SoundWave Pro", owner: "Farhan Ali",
    city: "Karachi", category: "sound-systems", verified: false, years: 9,
    about: "Professional sound, DJ and microphone setups for weddings and conferences.",
    title: "Sound System and DJ Setup", price: 25000, pricingType: "fixed",
    features: "Line-array speakers, wireless microphones, sound engineer",
    inc: [
      "Speakers and 2 wireless microphones for up to 150 guests",
      "Full PA system, DJ console and engineer for up to 400 guests",
      "Concert-grade system, DJ, monitors and backup equipment",
    ],
  },
  {
    key: "lens-and-light-studio", business: "Lens & Light Studio", owner: "Hamza Qureshi",
    city: "Lahore", category: "photography", verified: true, years: 10,
    about: "Wedding and event photography with fast editing and printed albums.",
    title: "Wedding Photography", price: 45000, pricingType: "fixed",
    features: "Edited photos in 7 days, online gallery, optional printed album",
    inc: [
      "One photographer, 6 hours, 200 edited photos",
      "Two photographers, full day, 500 edited photos and online gallery",
      "Two photographers, full day, drone shots and premium printed album",
    ],
  },
  {
    key: "cinematic-frames", business: "Cinematic Frames", owner: "Zain Abbas",
    city: "Islamabad", category: "videography", verified: false, pendingVerification: true, years: 5,
    about: "Cinematic wedding films, event highlights and corporate videos.",
    title: "Cinematic Wedding Film", price: 70000, pricingType: "fixed",
    features: "4K video, highlight reel, drone footage on request",
    inc: [
      "One videographer, 5-minute highlight reel",
      "Two videographers, highlight reel and full ceremony video",
      "Cinematic team, drone, teaser, highlight and full-length film",
    ],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: "demo.organizer@eventhub.pk" },
    update: {
      name: "Ahmed Khan (Demo Organizer)",
      organizationName: "TechCorp Events",
      city: "Lahore",
    },
    create: {
      name: "Ahmed Khan (Demo Organizer)",
      email: "demo.organizer@eventhub.pk",
      passwordHash,
      role: "buyer",
      city: "Lahore",
      phone: "0301 2223344",
      organizationName: "TechCorp Events",
    },
  });

  for (const s of sellers) {
    const email = `demo.${s.key}@eventhub.pk`;

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: s.owner,
        email,
        passwordHash,
        role: "seller",
        city: s.city,
        phone: "0300 0000000",
        sellerProfile: {
          create: {
            businessName: s.business,
            contactPerson: s.owner,
            description: s.about,
            experienceYears: s.years,
            location: s.city,
            serviceAreas: `${s.city} and nearby cities`,
            isVerified: s.verified,
            verificationStatus: s.verified ? "approved" : s.pendingVerification ? "submitted" : "not_submitted",
          },
        },
      },
    });

    const category = await prisma.category.findUnique({ where: { slug: s.category } });
    if (!category) throw new Error(`Category "${s.category}" not found. Run: npx prisma db seed`);

    const exists = await prisma.listing.findFirst({ where: { sellerId: user.id, title: s.title } });
    if (!exists) {
      await prisma.listing.create({
        data: {
          sellerId: user.id,
          categoryId: category.id,
          title: s.title,
          description: s.about,
          location: s.city,
          price: s.price,
          pricingType: s.pricingType,
          features: s.features,
          status: "APPROVED",
          packages: {
            create: TIERS.map(([tier, name, mult], i) => ({
              tier,
              name,
              price: Math.round(s.price * mult),
              inclusions: s.inc[i],
            })),
          },
        },
      });
    }

    if (s.pendingVerification) {
      const has = await prisma.verificationRequest.count({ where: { userId: user.id } });
      if (!has) {
        await prisma.verificationRequest.create({
          data: { userId: user.id, documentType: "PROFILE_ONLY", note: "Demo request" },
        });
      }
    }
  }

  console.log("Demo data ready.");
  console.log(`Organizer: demo.organizer@eventhub.pk / ${PASSWORD}`);
  console.log(`Demo seller logins: demo.<name>@eventhub.pk / ${PASSWORD}`);
  console.log("Example provider: demo.lahore-grand-caterers@eventhub.pk");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());