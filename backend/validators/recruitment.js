import { z } from "zod";
import { recruitmentErrors } from "../../shared/recruitmentConfig.js";

export const recruitmentSchema = z.object({
  year: z.number().int(),
  student_type: z.enum(["first-year", "normal", "lateral"]),
  name: z.string().trim().min(1).max(120),
  phone: z.string(),
  email: z.string().trim().email().max(254),
  usn: z.string().trim().min(6).max(20),
  branch: z.string().trim().min(1).max(100),
  section: z.string().trim().min(1).max(40),
  first_preference: z.string(),
  second_preference: z.string(),
  rules_accepted: z.literal(true),
}).strict().superRefine((data, context) => {
  for (const [path, message] of Object.entries(recruitmentErrors(data))) {
    context.addIssue({ code: "custom", path: [path], message });
  }
});
