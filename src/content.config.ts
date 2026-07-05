import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Projekte (Works): eine YAML-Datei pro Projekt, editierbar über Pages CMS
const works = defineCollection({
  loader: glob({ pattern: '*.yml', base: './content/works' }),
  schema: z.any(),
});

// Globale Inhalte: home.yml, about.yml, legal.yml, settings.yml
const globals = defineCollection({
  loader: glob({ pattern: '*.yml', base: './content' }),
  schema: z.any(),
});

export const collections = { works, globals };
