// One JSON file per course in this folder so Decap CMS can edit them individually.
// Admin UI: /admin -> "Courses".
const courseFiles = import.meta.glob('./*.json', {
    eager: true,
    import: 'default',
});

// `order` decides the listing order on the home page and /courses. Ties fall back
// to the title so a course added without an order still lands somewhere sensible.
export const courses = Object.values(courseFiles).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.courseTitle.localeCompare(b.courseTitle),
);

// Course titles are gradient text (bg-clip-text + text-transparent), so a course
// with an empty `gradientClass` would get an invisible title. Use this instead.
export const DEFAULT_GRADIENT_CLASS = 'from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400';
