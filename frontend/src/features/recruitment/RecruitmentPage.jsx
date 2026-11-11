import { useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, ChevronDown } from "lucide-react";
import http from "@/lib/http";
import { recruitmentConfig, recruitmentErrors, recruitmentReady, recruitmentRulesAvailable } from "../../../../shared/recruitmentConfig.js";
import "./recruitment.css";

const EMPTY_FORM = { name: "", phone: "", email: "", usn: "", branch: "", section: "", rules_accepted: false };

function Field({ id, label, hint, error, children }) {
  return (
    <div className="mc-recruit-field">
      <label htmlFor={id}>{label} <span aria-hidden="true">*</span></label>
      {children}
      {hint && <p className="mc-recruit-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="mc-recruit-error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}

export default function RecruitmentPage() {
  const [searchParams] = useSearchParams();
  const [year, setYear] = useState(null);
  const [typeByYear, setTypeByYear] = useState({ 2: null, 3: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [preferences, setPreferences] = useState([]);
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const studentType = year === 1 ? "first-year" : typeByYear[year];
  const readyForForm = Boolean(year && studentType);
  const payload = {
    ...form,
    year,
    student_type: studentType,
    first_preference: preferences[0] || "",
    second_preference: preferences[1] || "",
  };
  const validation = recruitmentErrors(payload);
  const valid = recruitmentReady && readyForForm && Object.keys(validation).length === 0;

  // Existing referral links used /register?ref= before this public intake
  // took that route. Keep those links pointed at account signup.
  const referralCode = searchParams.get("ref");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => ({ ...current, [field]: undefined }));
    setMessage("");
  }

  function fieldError(field) {
    return serverErrors[field] || ((attempted || touched[field]) ? validation[field] : undefined);
  }

  function togglePreference(id) {
    setPreferences((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 2 ? [...current, id] : current);
    setServerErrors((current) => ({ ...current, first_preference: undefined, second_preference: undefined }));
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || status === "success") return;
    setAttempted(true);
    if (!valid) {
      const first = Object.keys(validation)[0];
      if (first) document.getElementById(`recruit-${first}`)?.focus();
      return;
    }
    submitting.current = true;
    setStatus("submitting");
    setMessage("");
    setServerErrors({});
    try {
      await http.post("/recruitment", payload);
      setStatus("success");
    } catch (error) {
      const issues = error.response?.data?.issues || [];
      setServerErrors(Object.fromEntries(issues.map((issue) => [issue.path, issue.message])));
      setMessage(error.response?.data?.error === "Validation failed"
        ? "Please check the highlighted fields and try again."
        : error.response?.data?.error || "Could not submit right now. Your entries are saved here; please try again.");
      setStatus("error");
    } finally {
      submitting.current = false;
    }
  }

  if (referralCode) return <Navigate to={`/signup?ref=${encodeURIComponent(referralCode)}`} replace />;

  if (status === "success") {
    return (
      <div className="mc-recruitment mc-recruit-success" role="status">
        <div className="mc-recruit-success-mark"><Check aria-hidden="true" size={34} /></div>
        <p className="mc-recruit-eyebrow">APPLICATION RECEIVED</p>
        <h1>Welcome to the next chapter.</h1>
        <p>Your recruitment registration has been submitted. The Asymptotes organisers will take it from here.</p>
        <Link to="/" className="mc-recruit-primary">Back to Asymptotes <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    );
  }

  return (
    <div className="mc-recruitment">
      <div className="mc-recruit-ambient" aria-hidden="true">∑</div>
      <div className="mc-recruit-wrap">
        <Link to="/" className="mc-recruit-back"><ArrowLeft size={16} aria-hidden="true" /> Back to the collective</Link>
        <header className="mc-recruit-intro">
          <p className="mc-recruit-eyebrow">CLUB ASYMPTOTES · BMSIT</p>
          <h1>Find your place <em>in the collective.</em></h1>
          <p>Tell us a little about yourself and choose where you would like to contribute. No account is needed to apply.</p>
        </header>

        <div className="mc-recruit-layout">
          <div className="mc-recruit-main">
            <section className="mc-recruit-card" aria-labelledby="recruit-year-title">
              <div className="mc-recruit-step"><span>01</span><div><p className="mc-recruit-eyebrow">START HERE</p><h2 id="recruit-year-title">Your year of study</h2></div></div>
              <div className="mc-recruit-years" role="group" aria-label="Year of study">
                {[1, 2, 3].map((choice) => (
                  <button key={choice} type="button" className="mc-recruit-choice" aria-pressed={year === choice}
                    onClick={() => { setYear(choice); setMessage(""); }}>
                    <span className="mc-recruit-choice-number">0{choice}</span>
                    <span>{choice === 1 ? "1st" : choice === 2 ? "2nd" : "3rd"} Year</span>
                    <span className="mc-recruit-choice-check" aria-hidden="true">{year === choice ? <Check size={17} /> : "↗"}</span>
                  </button>
                ))}
              </div>
              {year > 1 && (
                <div className="mc-recruit-type" role="group" aria-label="Entry type">
                  <p>How did you join this year?</p>
                  <div className="mc-recruit-type-options">
                    {["normal", "lateral"].map((type) => (
                      <button key={type} type="button" aria-pressed={studentType === type}
                        onClick={() => setTypeByYear((current) => ({ ...current, [year]: type }))}>
                        {type === "normal" ? "Normal" : "Lateral"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {year && <p className="mc-recruit-keep">You can change your selection anytime. Your answers below will stay here.</p>}
            </section>

            {readyForForm && (
              <form onSubmit={submit} noValidate>
                <section className="mc-recruit-card" aria-labelledby="recruit-details-title">
                  <div className="mc-recruit-step"><span>02</span><div><p className="mc-recruit-eyebrow">THE ESSENTIALS</p><h2 id="recruit-details-title">About you</h2></div></div>
                  <div className="mc-recruit-grid">
                    <Field id="recruit-name" label="Full name" error={fieldError("name")}
                      ><input id="recruit-name" autoComplete="name" maxLength={120} required value={form.name}
                        aria-invalid={Boolean(fieldError("name"))} aria-describedby={fieldError("name") ? "recruit-name-error" : undefined}
                        onBlur={() => setTouched((current) => ({ ...current, name: true }))} onChange={(event) => update("name", event.target.value)} placeholder="As on your college record" /></Field>
                    <Field id="recruit-phone" label="Phone number" error={fieldError("phone")}
                      ><input id="recruit-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} required value={form.phone}
                        aria-invalid={Boolean(fieldError("phone"))} aria-describedby={fieldError("phone") ? "recruit-phone-error" : undefined}
                        onBlur={() => setTouched((current) => ({ ...current, phone: true }))} onChange={(event) => update("phone", event.target.value)} placeholder="Your contact number" /></Field>
                    <Field id="recruit-email" label={studentType === "normal" ? "BMSIT email" : "Personal email"}
                      hint={studentType === "normal" ? "Use your college address ending in @bmsit.in." : "Use an email address you check regularly, outside @bmsit.in."}
                      error={fieldError("email")}>
                      <input id="recruit-email" type="email" autoComplete="email" maxLength={254} required value={form.email}
                        aria-invalid={Boolean(fieldError("email"))} aria-describedby={`recruit-email-hint${fieldError("email") ? " recruit-email-error" : ""}`}
                        onBlur={() => setTouched((current) => ({ ...current, email: true }))} onChange={(event) => update("email", event.target.value)} placeholder={studentType === "normal" ? "your.usn@bmsit.in" : "you@example.com"} />
                    </Field>
                    <Field id="recruit-usn" label="USN" error={fieldError("usn")}
                      ><input id="recruit-usn" autoCapitalize="characters" maxLength={20} required value={form.usn}
                        aria-invalid={Boolean(fieldError("usn"))} aria-describedby={fieldError("usn") ? "recruit-usn-error" : undefined}
                        onBlur={() => setTouched((current) => ({ ...current, usn: true }))} onChange={(event) => update("usn", event.target.value.toUpperCase())} placeholder="Your university seat number" /></Field>
                    {[["branch", "Branch", recruitmentConfig.branches], ["section", "Section", recruitmentConfig.sections]].map(([key, label, choices]) => (
                      <Field key={key} id={`recruit-${key}`} label={label} error={fieldError(key)}
                        hint={!choices.length ? `Enter your official ${key} as shown on your college record.` : undefined}>
                        {choices.length ? (
                          <div className="mc-recruit-select"><select id={`recruit-${key}`} required value={form[key]}
                            aria-invalid={Boolean(fieldError(key))} aria-describedby={fieldError(key) ? `recruit-${key}-error` : undefined}
                            onBlur={() => setTouched((current) => ({ ...current, [key]: true }))} onChange={(event) => update(key, event.target.value)}>
                            <option value="">Choose {label.toLowerCase()}</option>
                            {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                          </select><ChevronDown size={17} aria-hidden="true" /></div>
                        ) : (
                          <input id={`recruit-${key}`} required maxLength={key === "branch" ? 100 : 40} value={form[key]}
                            aria-invalid={Boolean(fieldError(key))} aria-describedby={`recruit-${key}-hint${fieldError(key) ? ` recruit-${key}-error` : ""}`}
                            onBlur={() => setTouched((current) => ({ ...current, [key]: true }))} onChange={(event) => update(key, event.target.value)} placeholder={`Your ${key}`} />
                        )}
                      </Field>
                    ))}
                  </div>
                </section>

                <section className="mc-recruit-card" aria-labelledby="recruit-preferences-title">
                  <div className="mc-recruit-step"><span>03</span><div><p className="mc-recruit-eyebrow">YOUR INTERESTS</p><h2 id="recruit-preferences-title">Choose two domains</h2></div></div>
                  <p className="mc-recruit-section-copy">Tap once for your 1st domain preference, then choose your 2nd. Tap a selected domain again to remove it.</p>
                  <div className="mc-recruit-preferences" role="group" aria-label="Recruitment domain preferences">
                    {recruitmentConfig.options.map((option, index) => {
                      const rank = preferences.indexOf(option.id) + 1;
                      return <button key={option.id} type="button" aria-pressed={Boolean(rank)} disabled={preferences.length === 2 && !rank}
                        className="mc-recruit-preference" onClick={() => togglePreference(option.id)}>
                        <span className="mc-recruit-pref-index">0{index + 1}</span>
                        <span className="mc-recruit-pref-content">
                          <span className="mc-recruit-pref-name">{option.label}</span>
                          <span className="mc-recruit-pref-description">{option.description}</span>
                        </span>
                        <strong>{rank ? `${rank}${rank === 1 ? "st" : "nd"}` : "+"}</strong>
                      </button>;
                    })}
                  </div>
                  <p className="mc-recruit-order" aria-live="polite">
                    <span>1st: {recruitmentConfig.options.find((option) => option.id === preferences[0])?.label || "Choose a domain"}</span>
                    <span>2nd: {recruitmentConfig.options.find((option) => option.id === preferences[1])?.label || "Choose another domain"}</span>
                  </p>
                  {(fieldError("first_preference") || fieldError("second_preference")) &&
                    <p className="mc-recruit-error" role="alert">Choose exactly two different domains.</p>}
                </section>

                <section className="mc-recruit-card mc-recruit-mobile-rules" aria-labelledby="recruit-mobile-rules-title">
                  <h2 id="recruit-mobile-rules-title">Recruitment rules</h2>
                  <Rules />
                </section>
                <section className="mc-recruit-card mc-recruit-submit" aria-label="Agreement and submission">
                  <label className="mc-recruit-agree" htmlFor="recruit-rules_accepted">
                    <input id="recruit-rules_accepted" type="checkbox" checked={form.rules_accepted} disabled={!recruitmentRulesAvailable}
                      aria-invalid={Boolean(fieldError("rules_accepted"))} aria-describedby={fieldError("rules_accepted") ? "recruit-rules-error" : undefined}
                      onChange={(event) => update("rules_accepted", event.target.checked)} />
                    <span>I have read and agree to the recruitment rules.</span>
                  </label>
                  {fieldError("rules_accepted") && recruitmentRulesAvailable && <p className="mc-recruit-error" id="recruit-rules-error" role="alert">{fieldError("rules_accepted")}</p>}
                  {!recruitmentReady && <p className="mc-recruit-config-note" role="status">Applications will open once the remaining official recruitment details are configured.</p>}
                  {message && <p className="mc-recruit-error" role="alert">{message}</p>}
                  <button className="mc-recruit-primary" type="submit" disabled={!valid || status === "submitting"}>
                    {status === "submitting" ? "Submitting your application…" : "Submit registration"}
                    {status !== "submitting" && <ArrowRight size={17} aria-hidden="true" />}
                  </button>
                  <p className="mc-recruit-privacy">Your details go only to the Asymptotes recruitment coordinators.</p>
                </section>
              </form>
            )}
          </div>

          <aside className="mc-recruit-aside" aria-labelledby="recruit-rules-title">
            <div className="mc-recruit-rules-card">
              <p className="mc-recruit-eyebrow">BEFORE YOU APPLY</p>
              <h2 id="recruit-rules-title">Recruitment rules</h2>
              <Rules />
              <div className="mc-recruit-aside-bottom">Good questions. Great company. Infinite potential. <span aria-hidden="true">↗</span></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Rules() {
  if (!recruitmentRulesAvailable) return <p className="mc-recruit-rules-missing">The official recruitment rules have not been provided yet. Please check back before applying.</p>;
  return <ol className="mc-recruit-rules-list">{recruitmentConfig.rules.map((rule) => <li key={rule}>{rule}</li>)}</ol>;
}
