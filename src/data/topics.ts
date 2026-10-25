import { getCollection, type CollectionEntry } from 'astro:content';
import { courses } from './courses';

type Topic = CollectionEntry<'codeArticles'>;

// Set by the CMS; older files fall back to their folder name
// (`src/content/courses/<course>/<article>.md`).
export function getTopicCourse(topic: Topic): string | undefined {
    return topic.data.course ?? topic.filePath?.split('/')[3];
}

// A topic goes on the site only when its course is available, it is not a
// draft, and its publish date has arrived. The site is static, so a scheduled
// topic appears on the first build after its publish date.
export function isTopicPublished(topic: Topic, now: Date = new Date()): boolean {
    const course = courses.find((c: any) => c.slug === getTopicCourse(topic));
    return course?.isAvailable === true
        && topic.data.isDraft !== true
        && topic.data.publishDate.valueOf() <= now.valueOf();
}

export async function getPublishedTopics(): Promise<Topic[]> {
    const now = new Date();
    return (await getCollection('codeArticles')).filter((topic) => isTopicPublished(topic, now));
}

export type CourseResources = { interviewQuestions: number; quizzes: number; projectIdeas: number };

// Published interview questions, quizzes and project ideas per available course.
// A course's resource pages and sidebar links exist only when it has items, so
// the site never publishes empty placeholder pages.
export async function getCourseResources(): Promise<Record<string, CourseResources>> {
    const [questions, quizzes, projects] = await Promise.all([
        getCollection('interviewQuestions'),
        getCollection('quizzes'),
        getCollection('projectIdeas'),
    ]);
    return Object.fromEntries(
        courses
            .filter((course: any) => course.isAvailable === true)
            .map((course: any) => [course.slug, {
                interviewQuestions: questions.filter((q) => q.data.course === course.slug).length,
                quizzes: quizzes.filter((q) => q.data.course === course.slug && q.data.isPublished).length,
                projectIdeas: projects.filter((p) => p.data.course === course.slug && p.data.isPublished).length,
            }])
    );
}
