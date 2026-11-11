/**
 * Recruitment intake configuration.
 *
 * The option IDs are the canonical domain names stored in registration rows.
 * The branch and section lists below are the approved dropdown values.
 * The rules below are the approved wording. Submission stays closed if
 * any of these required lists are removed.
 * This file is intentionally safe to ship to the browser.
 */
export const recruitmentConfig = {
  options: [
    { id: "Event Design", label: "Event Design", description: "Designing and sketching events from scratch." },
    { id: "Marketing & Social Media", label: "Marketing & Social Media", description: "Promoting the club and creating content for social media." },
    { id: "PR & Sponsorship", label: "PR & Sponsorship", description: "Communicating with people and reaching out to potential sponsors." },
    { id: "Technology & Systems", label: "Technology & Systems", description: "Building and managing the technology and systems used by the club." },
    { id: "Quantitative Strategy", label: "Quantitative Strategy", description: "Using mathematics and data to plan and improve club activities." },
  ],
  branches: ["CSE", "AIML", "CIVIL", "ECE", "EEE", "CSBS", "MECH"],
  sections: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
  rules: [
    "Please enter all details carefully and accurately.",
    "Providing incorrect information or misusing the registration may result in strict action.",
    "Lateral entry is for diploma students.",
    "The interview will be scheduled according to your IA exam schedule.",
  ],
};

export const recruitmentRulesAvailable = recruitmentConfig.rules.length > 0;
export const recruitmentReady = recruitmentRulesAvailable &&
  recruitmentConfig.branches.length > 0 && recruitmentConfig.sections.length > 0;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9]{10}$/;
const usnPattern = /^[A-Z0-9]{6,20}$/i;

/** Field errors shared by the React form and the Express validator. */
export function recruitmentErrors(value) {
  const errors = {};
  const year = Number(value.year);
  const type = value.student_type;
  const text = (field) => String(value[field] ?? "").trim();
  const choiceIds = recruitmentConfig.options.map((option) => option.id);

  if (![1, 2, 3].includes(year)) errors.year = "Choose your year.";
  if (year === 1 && type !== "first-year") errors.student_type = "Choose 1st Year.";
  if ([2, 3].includes(year) && !["normal", "lateral"].includes(type)) {
    errors.student_type = "Choose Normal or Lateral.";
  }
  if (!text("name") || text("name").length > 120) errors.name = "Enter your full name (up to 120 characters).";
  if (!phonePattern.test(String(value.phone ?? ""))) {
    errors.phone = "Enter a 10-digit phone number using numbers only.";
  }
  if (!emailPattern.test(text("email")) || text("email").length > 254) {
    errors.email = "Enter a valid email address.";
  } else if (type === "normal" && !/@bmsit\.in$/i.test(text("email"))) {
    errors.email = "Use your BMSIT email ending in @bmsit.in.";
  } else if (type !== "normal" && /@bmsit\.in$/i.test(text("email"))) {
    errors.email = "Use your personal email address.";
  }
  if (!usnPattern.test(text("usn"))) errors.usn = "Enter your USN using 6–20 letters or numbers.";
  if (!text("branch") || text("branch").length > 100) errors.branch = "Select your branch.";
  else if (recruitmentConfig.branches.length && !recruitmentConfig.branches.includes(text("branch"))) {
    errors.branch = "Choose a listed branch.";
  }
  if (!text("section") || text("section").length > 40) errors.section = "Select your section.";
  else if (recruitmentConfig.sections.length && !recruitmentConfig.sections.includes(text("section"))) {
    errors.section = "Choose a listed section.";
  }
  if (!choiceIds.includes(value.first_preference)) errors.first_preference = "Choose a 1st domain preference.";
  if (!choiceIds.includes(value.second_preference) || value.second_preference === value.first_preference) {
    errors.second_preference = "Choose a different 2nd domain preference.";
  }
  if (value.rules_accepted !== true) errors.rules_accepted = "Please read and accept the rules.";
  return errors;
}
