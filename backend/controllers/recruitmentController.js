import supabase from "../config/supabase.js";
import { recruitmentReady } from "../../shared/recruitmentConfig.js";

/** Anonymous intake. Return no submitted details or database identifiers. */
export async function submitRecruitment(req, res) {
  if (!recruitmentReady) {
    return res.status(503).json({ error: "Recruitment details have not been configured yet." });
  }

  const { year, student_type, name, phone, email, usn, branch, section,
    first_preference, second_preference, rules_accepted } = req.body;

  try {
    const { error } = await supabase.from("recruitment_registrations").insert({
      year,
      student_type,
      name,
      phone,
      email: email.toLowerCase(),
      usn: usn.toUpperCase(),
      branch,
      section,
      first_preference,
      second_preference,
      rules_accepted,
    });
    if (error) throw error;
  } catch {
    // Keep database diagnostics and submitted personal data out of public responses/logs.
    return res.status(503).json({ error: "We could not save your registration. Please try again." });
  }
  return res.status(201).json({ message: "Your recruitment registration was received." });
}
