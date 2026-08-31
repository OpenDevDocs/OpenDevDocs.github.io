import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

// YAML turns a full ISO timestamp (what the CMS writes) into a Date, while the
// older `2025-05-24T08:30` frontmatter stays a string. Coercion accepts both.
const dateValue = z.coerce.date();

// Course topic articles: `src/content/courses/<language>/<article>.md`
const codeArticles = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/courses/' }),
    schema: z.object({
        title: z.string(),
        slug: z.string(),
        metadescription: z.string(),
        featuredImage: z.string().optional(),
        publishDate: dateValue,
        updateDate: dateValue,
        author: z.array(z.string()),
        level: z.number(),
        tags: z.array(z.string()),
        // Written by the CMS so it knows which language folder an article belongs to.
        // Existing files fall back to the folder name in the route.
        course: z.string().optional(),
    }),
});

// Blog posts: `src/content/blog/<post>.md`
const blog = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/blog/' }),
    schema: z.object({
        title: z.string(),
        slug: z.string(),
        metadescription: z.string(),
        featuredImage: z.string().optional(),
        publishDate: dateValue,
        updateDate: dateValue,
        author: z.array(z.string()),
        category: z.string().default('General'),
        tags: z.array(z.string()).default([]),
        isDraft: z.boolean().default(false),
    }),
});

// Legal pages: `src/content/legal/<page>.md`, served at the site root (`/privacy-policy`).
const legal = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/legal/' }),
    schema: z.object({
        title: z.string(),
        slug: z.string(),
        metadescription: z.string(),
        badge: z.string().optional(),
        heroHeadline: z.string().optional(),
        heroSubHeadline: z.string().optional(),
        summary: z.string().optional(),
        highlights: z.array(z.string()).default([]),
        updateDate: dateValue,
        order: z.number().default(0),
        showInFooter: z.boolean().default(true),
    }),
});

// Interview questions: `src/content/interview-questions/<course>/<question>.md`
const interviewQuestions = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/interview-questions/' }),
    schema: z.object({
        course: z.string(),
        slug: z.string(),
        experienceLevel: z.enum(['fresher', 'mid', 'senior']),
        difficulty: z.enum(['easy', 'medium', 'hard']),
        tags: z.array(z.string()).default([]),
        question: z.string(),
        answer: z.string(),
        codeExample: z.string().optional(),
        popularity: z.number().default(8),
        isPublished: z.boolean().default(true),
    }),
});

// Expose your defined collection to Astro
// with the `collections` export
export const collections = { codeArticles, blog, legal, interviewQuestions };
