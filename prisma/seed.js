require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Service categories follow your project scope (SRS 1.1)
const serviceCategories = [
  { name: "Catering", slug: "catering" },
  { name: "Decoration", slug: "decoration" },
  { name: "Lighting", slug: "lighting" },
  { name: "Sound Systems", slug: "sound-systems" },
  { name: "Photography", slug: "photography" },
  { name: "Videography", slug: "videography" },
];

// Event categories match the Create Event page in the frontend
const eventCategories = [
  "Wedding",
  "Corporate",
  "Birthday",
  "Conference",
  "Concert",
  "Exhibition",
].map((name) => ({ name, slug: name.toLowerCase() }));

async function main() {
  for (const c of serviceCategories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, type: "service" },
      create: { ...c, type: "service" },
    });
  }

  for (const c of eventCategories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, type: "event" },
      create: { ...c, type: "event" },
    });
  }

  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL },
    update: {}, // never overwrite an existing admin password
    create: {
      name: "EventHub Admin",
      email: process.env.ADMIN_EMAIL,
      passwordHash,
      role: "admin",
    },
  });

  console.log("Seed finished: categories and admin account are ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());