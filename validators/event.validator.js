const { z } = require("zod");

const fields = {
  name: z.string().trim().min(3, "Event name must be at least 3 characters.").max(150),
  category: z.string().trim().min(2, "Select a category.").max(60),
  eventDate: z.coerce.date(),
  eventTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must look like 18:30."),
  location: z.string().trim().min(2, "Enter the event location.").max(200),
  guests: z.coerce.number().int().min(1, "Guests must be at least 1.").max(100000),
  budget: z.coerce.number().positive("Budget must be greater than 0.").max(1000000000),
  description: z.string().trim().max(3000).nullable(),
  services: z.array(z.string().trim().min(1).max(60)).max(20),
  status: z.enum(["DRAFT", "UPCOMING"]),
};

const REQUIRED = ["category", "eventDate", "eventTime", "location", "guests", "budget"];

// A draft only needs a name. A normal event needs every detail.
const createEventSchema = z
  .object({
    name: fields.name,
    category: fields.category.optional(),
    eventDate: fields.eventDate.optional(),
    eventTime: fields.eventTime.optional(),
    location: fields.location.optional(),
    guests: fields.guests.optional(),
    budget: fields.budget.optional(),
    description: fields.description.optional(),
    services: fields.services.optional(),
    status: fields.status.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.status === "DRAFT") return;
    REQUIRED.forEach((key) => {
      if (d[key] === undefined) {
        ctx.addIssue({ code: "custom", path: [key], message: "This field is required." });
      }
    });
  });

const updateEventSchema = z.object(fields).partial();

const serviceStatusSchema = z.object({
  status: z.enum(["NEEDED", "IN_DISCUSSION", "BOOKED", "DONE"], {
    message: "Status must be NEEDED, IN_DISCUSSION, BOOKED or DONE.",
  }),
});

module.exports = { createEventSchema, updateEventSchema, serviceStatusSchema };