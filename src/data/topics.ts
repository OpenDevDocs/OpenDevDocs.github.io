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
