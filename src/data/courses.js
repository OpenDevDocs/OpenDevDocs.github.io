// Language/course records live in `src/data/courses.json` so Decap CMS can edit them.
// Admin UI: /admin -> "Site Data" -> "Languages".
import data from './courses.json';

export const courses = data.courses;
