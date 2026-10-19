/**
 * CaptureNote — Use Case
 *
 * Orchestrates: validate DTO → build markdown → write via ContentStore → return Result.
 *
 * @param {{ contentStore: ContentStore, eventBus: EventBus }} deps
 * @returns {(dto: CaptureNoteDto) => Promise<Result<{filePath: string}>>}
 */
import { Result, InfrastructureError } from '#domain';

export function createCaptureNote({ contentStore, eventBus }) {
  return async function captureNote(dto) {
    // 1. Determine target path
    const STUDY_PATH = '02 - APRENDIZAJE/MoureDev-Master';
    const INBOX_DIR = `${STUDY_PATH}/_campus/_inbox`;

    // 2. Ensure inbox dir exists
    const dirResult = await contentStore.ensureDir(INBOX_DIR);
    if (dirResult.isFailure) return dirResult;

    // 3. Build filename + content
    const slug = generateSlug(dto.title);
    const date = new Date().toISOString().split('T')[0];
    const filename = `${slug}-${date}.md`;

    const frontmatter = buildFrontmatter({
      'entity_type::': dto.entityType,
      'source::': dto.sourceUrl,
      'fecha_captura::': date,
      'tags::': dto.tags,
      'conceptos_clave::': '',
      'status::': 'pending',
      'priority::': dto.priority,
      'energy::': dto.energy,
      'focus::': dto.focus,
    });

    const noteContent = `${frontmatter}\n\n# ${dto.title}\n\n${dto.content}\n`;

    const filePath = `${INBOX_DIR}/${filename}`;

    // 4. Write via port
    const writeResult = await contentStore.write(filePath, noteContent);
    if (writeResult.isFailure) return writeResult;

    // 5. Publish domain event
    if (eventBus) {
      await eventBus.publish({
        type: 'note.captured',
        payload: { filePath, entityType: dto.entityType, title: dto.title },
      });
    }

    return Result.ok({ filePath });
  };
}

// ─── Helpers (pure functions) ───────────────────────────────

function generateSlug(text, maxLen = 40) {
  return text
    .slice(0, maxLen)
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function buildFrontmatter(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value !== '' && value !== undefined && value !== null) {
      lines.push(`${key} ${value}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
