const { z } = require("zod");

const packageItem = z.object({
  tier: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
  name: z.string().trim().max(60).optional(),
  price: z.coerce.number().positive("Price must be greater than 0.").max(100000000),
  inclusions: z.string().trim().min(3, "Describe what is included.").max(3000),
});

const setPackagesSchema = z
  .object({ packages: z.array(packageItem).min(1).max(3) })
  .refine((d) => new Set(d.packages.map((p) => p.tier)).size === d.packages.length, {
    message: "Each package tier can be used only once.",
    path: ["packages"],
  });

module.exports = { setPackagesSchema };