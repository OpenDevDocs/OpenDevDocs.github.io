// Each course syllabus is a JSON file in `src/data/syllabus/` so Decap CMS can edit
// them one course at a time. Admin UI: /admin -> "Course Syllabus".
const syllabusFiles = import.meta.glob('../data/syllabus/*.json', {
    eager: true,
    import: 'default',
});

export let syllabus = Object.keys(syllabusFiles)
    .sort()
    .map((path) => syllabusFiles[path]);
