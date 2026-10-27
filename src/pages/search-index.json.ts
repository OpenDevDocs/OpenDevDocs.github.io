import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { courses } from '../data/courses';
import { getPublishedTopics, getTopicCourse } from '../data/topics';

// Everything the header search can find, built once per deploy. The search box
// fetches it on first open, so pages that never search never download it.
// Keys are kept short because this file holds every lesson on the site:
// k = kind, t = title, u = url, c = course title, d = description, x = extra
// search text (tags, lesson headings) that is matched but not shown.
type Entry = { k: 'course' | 'lesson' | 'blog' | 'interview'; t: string; u: string; c?: string; d?: string; x?: string };

// Turns inline markdown into plain text: `code`, **bold**, [links](url).
const plain = (text: string) =>
    text
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[`*_]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

// Lesson section headings make lessons findable by what they cover, not only
// by their title. Fenced code is skipped so `# comment` lines are not picked up.
function headings(body = '') {
    const found: string[] = [];
    let inFence = false;
    for (const line of body.split('\n')) {
        if (/^\s*```/.test(line)) inFence = !inFence;
        else if (!inFence) {
            const match = line.match(/^#{2,3}\s+(.+)$/);
            if (match) found.push(plain(match[1]));
        }
    }
    return found;
}

const LEVELS: Record<string, string> = { fresher: 'Fresher', mid: 'Mid-level', senior: 'Senior' };

export const GET: APIRoute = async () => {
    const available = courses.filter((course: any) => course.isAvailable === true);
    const courseTitle = new Map(available.map((course: any) => [course.slug, course.courseTitle as string]));

    const [topics, posts, questions] = await Promise.all([
        getPublishedTopics(),
        getCollection('blog'),
        getCollection('interviewQuestions'),
    ]);

    const entries: Entry[] = [
        ...available.map((course: any): Entry => ({
            k: 'course',
            t: course.courseTitle,
            u: `/courses/${course.slug}/`,
            d: course.cardText,
            x: [course.tags, course.descriptionText].filter(Boolean).join(' '),
        })),
        ...topics.map((topic): Entry => {
            const course = getTopicCourse(topic) ?? '';
            return {
                k: 'lesson',
                t: topic.data.title,
                u: `/courses/${course}/${topic.data.slug}/`,
                c: courseTitle.get(course),
                d: topic.data.metadescription,
                x: [...topic.data.tags, ...headings(topic.body)].join(' '),
            };
        }),
        ...posts
            .filter((post) => post.data.isDraft === false)
            .map((post): Entry => ({
                k: 'blog',
                t: post.data.title,
                u: `/blog/${post.data.slug}/`,
                c: post.data.category,
                d: post.data.metadescription,
                x: post.data.tags.join(' '),
            })),
        // The interview page opens the question whose id is in `#q=<id>`.
        ...questions
            .filter((q) => q.data.isPublished && courseTitle.has(q.data.course))
            .map((q): Entry => ({
                k: 'interview',
                t: plain(q.data.question),
                u: `/courses/${q.data.course}/interview-questions/#q=${q.id}`,
                c: `${courseTitle.get(q.data.course)} · ${LEVELS[q.data.experienceLevel]}`,
                x: q.data.tags.join(' '),
            })),
    ];

    return new Response(JSON.stringify(entries), {
        headers: { 'Content-Type': 'application/json' },
    });
};
