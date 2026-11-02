import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowUpRight, Code2, Github, Plus, Presentation, ThumbsUp, Users, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { PageHeader, TiltPanel, SegmentedTabs, EmptyState } from "@/components/lamp";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import Loader from "@/components/ui/Loader";
import { projects } from "@/lib/api";

const fieldClass =
  "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-3 text-sm text-text-primary outline-none transition duration-200 placeholder:text-text-dim focus:border-primary/45 focus:ring-2 focus:ring-primary/15";

// Forms unfold from their top edge like a sheet being pulled down.
const sheet = {
  initial: { opacity: 0, height: 0, rotateX: -12 },
  animate: { opacity: 1, height: "auto", rotateX: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, height: 0, rotateX: -8, transition: { duration: 0.35, ease: [0.4, 0, 1, 1] } },
};

export default function ProjectsPage() {
  const [projectList, setProjectList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Create team form — one slot per additional member (leader is
  // implicit). Backend requires 3-6 members total, so we surface 2-5
  // extra email slots.
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamMemberEmails, setTeamMemberEmails] = useState(["", "", ""]);
  const [teamLoading, setTeamLoading] = useState(false);

  // Submit project form. Three URL columns on the projects row —
  // github_url, demo_url, slides_url — all optional. Teams typically
  // submit at least one (code or live demo); slides are common for
  // class showcases where there's a presentation component.
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectCategory, setProjectCategory] = useState("");
  const [projectGithub, setProjectGithub] = useState("");
  const [projectDemo, setProjectDemo] = useState("");
  const [projectSlides, setProjectSlides] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);

  // Voting
  const [votingId, setVotingId] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      setLoading(true);
      setError(null);
      const [projRes, catRes, teamRes] = await Promise.all([
        projects.list(),
        projects.categories(),
        projects.myTeam().catch(() => ({ data: null })),
      ]);
      setProjectList(projRes.data);
      setCategories(catRes.data);
      // Backend shape is { team: <team|null>, project: <project|null> }.
      // The UI previously stored the whole wrapper, so `myTeam` was
      // always truthy (even with no team), which hid the "Create Team"
      // button and showed "Submit Project" for users with no team —
      // producing the "Failed to submit project" crash because the
      // submit endpoint requires a teamId.
      setMyTeam(teamRes.data?.team || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTeam(e) {
    e.preventDefault();
    try {
      setTeamLoading(true);
      // Backend validator (createTeamSchema) expects `memberEmails`.
      // Earlier this was sent as `members` which Zod silently stripped,
      // leaving the controller with zero emails and tripping its
      // "Minimum 3 members required" 400.
      const cleanedEmails = teamMemberEmails.map((e) => e.trim()).filter(Boolean);
      const { data } = await projects.createTeam({
        name: teamName,
        memberEmails: cleanedEmails,
      });
      setMyTeam(data?.team || data);
      setShowTeamForm(false);
      setTeamName("");
      setTeamMemberEmails(["", "", ""]);
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || "Failed to create team");
    } finally {
      setTeamLoading(false);
    }
  }

  function updateMemberEmail(idx, value) {
    setTeamMemberEmails((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function addMemberSlot() {
    // Backend cap is 6 total members (leader + 5 additional).
    setTeamMemberEmails((prev) => (prev.length >= 5 ? prev : [...prev, ""]));
  }

  function removeMemberSlot(idx) {
    // Keep at least 2 slots visible so the form never collapses below
    // a valid team size (leader + 2 = 3 minimum).
    setTeamMemberEmails((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function handleSubmitProject(e) {
    e.preventDefault();
    // Defensive: the button should already be hidden without a team,
    // but if something slips through we fail fast with a clear error.
    if (!myTeam?.id) {
      alert("Create a team before submitting a project.");
      return;
    }
    try {
      setSubmitLoading(true);
      await projects.submit({
        teamId: myTeam.id,
        title: projectTitle,
        description: projectDescription,
        category: projectCategory,
        github_url: projectGithub || "",
        demo_url:   projectDemo   || "",
        slides_url: projectSlides || "",
      });
      setShowProjectForm(false);
      setProjectTitle("");
      setProjectDescription("");
      setProjectCategory("");
      setProjectGithub("");
      setProjectDemo("");
      setProjectSlides("");
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || "Failed to submit project");
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleVote(id) {
    try {
      setVotingId(id);
      await projects.vote(id);
      setProjectList((prev) =>
        prev.map((p) =>
          p._id === id ? { ...p, votes: (p.votes || 0) + 1, hasVoted: true } : p
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to vote");
    } finally {
      setVotingId(null);
    }
  }

  const filteredProjects =
    selectedCategory === "All"
      ? projectList
      : projectList.filter((p) => p.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader variant="orbit" size="lg" label="Loading projects..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-danger">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchAll}>
          Retry
        </Button>
      </div>
    );
  }

  const categoryTabs = [
    { value: "All", label: "All", count: projectList.length },
    ...categories.map((cat) => {
      const value = cat._id || cat.name;
      return { value, label: cat.name, count: projectList.filter((p) => p.category === value).length };
    }),
  ];

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        context="Innovation hub"
        title="Projects"
        description="Browse, create, and vote on math projects."
        actions={
          <>
            {!myTeam && (
              <Button
                variant={showTeamForm ? "ghost" : "secondary"}
                onClick={() => setShowTeamForm(!showTeamForm)}
                leading={showTeamForm ? <X className="h-4 w-4" strokeWidth={1.75} /> : <Users className="h-4 w-4" strokeWidth={1.75} />}
              >
                {showTeamForm ? "Cancel" : "Create team"}
              </Button>
            )}
            {myTeam && (
              <Button
                variant={showProjectForm ? "ghost" : "primary"}
                onClick={() => setShowProjectForm(!showProjectForm)}
                leading={showProjectForm ? <X className="h-4 w-4" strokeWidth={1.75} /> : <Plus className="h-4 w-4" strokeWidth={1.75} />}
              >
                {showProjectForm ? "Cancel" : "Submit project"}
              </Button>
            )}
          </>
        }
      />

      {/* My Team Card */}
      {myTeam && (
        <TiltPanel lit data-reveal="up" className="p-6 sm:p-7">
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-primary">Your team</p>
              <h2 className="mt-1 truncate text-2xl text-text-primary sm:text-3xl">{myTeam.name}</h2>
            </div>
            <ul data-stagger="scale" className="flex flex-wrap gap-2">
              {(myTeam.members || []).map((m, i) => {
                const label = m.name || m.email || m;
                return (
                  <li
                    key={i}
                    className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--rule))] bg-surface/60 py-1 pl-1 pr-3 text-[13px] text-text-muted"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/20 text-[11px] font-semibold uppercase text-secondary">
                      {String(label).charAt(0)}
                    </span>
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>
        </TiltPanel>
      )}

      <AnimatePresence initial={false}>
        {/* Create Team Form */}
        {showTeamForm && (
          <motion.section key="team-form" {...sheet} className="origin-top overflow-hidden [perspective:1200px]">
            <div className="lamp-panel p-6 sm:p-8">
              <h2 className="text-2xl text-text-primary">Create your team</h2>
              <p className="mt-1 text-sm text-text-muted">You lead the team. Name it and invite your teammates.</p>
              <form onSubmit={handleCreateTeam} className="mt-6 max-w-2xl space-y-5">
                <InputField
                  label="Team Name"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. Euler's Engineers"
                  required
                />
                <div>
                  <span className="mb-1 block text-[13px] font-medium text-text-muted">
                    Teammate emails
                  </span>
                  <p className="mb-3 text-xs text-text-dim">
                    You are the team leader. Add 2–5 teammates by email (teams need 3–6 members in total).
                  </p>
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                      {teamMemberEmails.map((emailValue, idx) => (
                        <motion.li
                          key={idx}
                          layout
                          initial={{ opacity: 0, x: -16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 16 }}
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="email"
                            value={emailValue}
                            onChange={(e) => updateMemberEmail(idx, e.target.value)}
                            placeholder={`teammate${idx + 1}@example.com`}
                            className={cn(fieldClass, "flex-1")}
                          />
                          {teamMemberEmails.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeMemberSlot(idx)}
                              aria-label={`Remove teammate ${idx + 1}`}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--rule))] text-text-dim transition hover:border-danger/40 hover:text-danger"
                            >
                              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                            </button>
                          )}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                  {teamMemberEmails.length < 5 && (
                    <button
                      type="button"
                      onClick={addMemberSlot}
                      className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-[rgb(var(--rule))] px-4 text-[13px] font-medium text-text-muted transition hover:border-primary/40 hover:text-text-primary"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      Add teammate
                    </button>
                  )}
                </div>
                <Button type="submit" loading={teamLoading}>
                  Create team
                </Button>
              </form>
            </div>
          </motion.section>
        )}

        {/* Submit Project Form */}
        {showProjectForm && (
          <motion.section key="project-form" {...sheet} className="origin-top overflow-hidden [perspective:1200px]">
            <div className="lamp-panel p-6 sm:p-8">
              <h2 className="text-2xl text-text-primary">Submit your project</h2>
              <p className="mt-1 text-sm text-text-muted">Submitting for {myTeam?.name || "your team"}. Links are optional, but judges love a live demo.</p>
              <form onSubmit={handleSubmitProject} className="mt-6 grid gap-5 lg:grid-cols-2">
                <div className="space-y-5">
                  <InputField
                    label="Project Title"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="Enter project title"
                    required
                  />
                  <InputField
                    label="Description"
                    multiline
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    placeholder="Describe your project..."
                    required
                  />
                  <label className="block">
                    <span className="mb-2 block text-[13px] font-medium text-text-muted">Category</span>
                    <select
                      value={projectCategory}
                      onChange={(e) => setProjectCategory(e.target.value)}
                      required
                      className={fieldClass}
                    >
                      <option value="" disabled>
                        Select category
                      </option>
                      {categories.map((cat) => (
                        <option key={cat._id || cat.name} value={cat._id || cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="space-y-5">
                  <InputField
                    label="GitHub URL (optional)"
                    value={projectGithub}
                    onChange={(e) => setProjectGithub(e.target.value)}
                    placeholder="https://github.com/your-team/project"
                  />
                  <InputField
                    label="Live demo URL (optional)"
                    value={projectDemo}
                    onChange={(e) => setProjectDemo(e.target.value)}
                    placeholder="https://your-deployed-site.com"
                  />
                  <InputField
                    label="Slides / pitch-deck URL (optional)"
                    value={projectSlides}
                    onChange={(e) => setProjectSlides(e.target.value)}
                    placeholder="https://docs.google.com/presentation/..."
                  />
                  <Button type="submit" loading={submitLoading}>
                    Submit project
                  </Button>
                </div>
              </form>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Category Filters */}
      <div data-reveal="fade">
        <SegmentedTabs
          aria-label="Filter projects by category"
          items={categoryTabs}
          value={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <EmptyState
          title="No projects found"
          body="Be the first to submit a project in this category."
          action={myTeam && !showProjectForm ? (
            <Button onClick={() => setShowProjectForm(true)} leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>Submit project</Button>
          ) : null}
        />
      ) : (
        <ul key={selectedCategory} data-stagger="tilt" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <li key={project._id}>
              <TiltPanel className="flex h-full flex-col p-5 sm:p-6">
                <div className="relative flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-lg leading-snug text-text-primary">
                    {project.title}
                  </h3>
                  <span className="shrink-0 rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-0.5 text-[12px] font-medium text-secondary">
                    {project.categoryName || project.category || "General"}
                  </span>
                </div>

                <p className="relative mt-2 line-clamp-3 text-sm leading-6 text-text-muted">
                  {project.description}
                </p>

                {project.teamName && (
                  <p className="relative mt-3 inline-flex items-center gap-1.5 text-[13px] text-text-dim">
                    <Users className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Team {project.teamName}
                  </p>
                )}

                {/* Three optional links — github / demo / slides. Each
                    populated URL renders as its own labelled link so
                    judges can jump to the right artefact without guessing. */}
                {(project.github_url || project.demo_url || project.slides_url) && (
                  <div className="relative mt-4 flex flex-wrap items-center gap-2">
                    {project.github_url && (
                      <ProjectLink href={project.github_url} icon={Github}>Code</ProjectLink>
                    )}
                    {project.demo_url && (
                      <ProjectLink href={project.demo_url} icon={Code2}>Live demo</ProjectLink>
                    )}
                    {project.slides_url && (
                      <ProjectLink href={project.slides_url} icon={Presentation}>Slides</ProjectLink>
                    )}
                  </div>
                )}

                <div aria-hidden="true" className="min-h-5 flex-1" />
                <div className="relative flex items-center justify-between gap-3 border-t border-[rgb(var(--rule))] pt-4">
                  <span className="inline-flex items-baseline gap-1.5 text-sm text-text-muted">
                    <span className="relative inline-flex h-7 min-w-[1.5ch] items-center overflow-hidden">
                      <AnimatePresence initial={false} mode="popLayout">
                        <motion.span
                          key={project.votes ?? 0}
                          initial={{ y: 22, opacity: 0, scale: 1.4 }}
                          animate={{ y: 0, opacity: 1, scale: 1 }}
                          exit={{ y: -22, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 420, damping: 22 }}
                          className="lamp-numerals inline-block text-xl text-primary"
                        >
                          {project.votes ?? 0}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    votes
                  </span>
                  <motion.div whileTap={project.hasVoted ? undefined : { scale: 0.92 }}>
                    <Button
                      variant={project.hasVoted ? "ghost" : "secondary"}
                      size="sm"
                      disabled={project.hasVoted}
                      loading={votingId === project._id}
                      onClick={() => handleVote(project._id)}
                      leading={<ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.75} />}
                    >
                      {project.hasVoted ? "Voted" : "Vote"}
                    </Button>
                  </motion.div>
                </div>
              </TiltPanel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectLink({ href, icon: Icon, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-[rgb(var(--rule))] bg-surface/50 px-3 text-[13px] text-text-muted transition hover:border-secondary/40 hover:text-text-primary"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
      {children}
      <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}
