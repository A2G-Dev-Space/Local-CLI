/**
 * Document Manager
 *
 * 로컬 마크다운 문서를 관리하는 시스템
 * 오프라인 환경에서 지식 베이스로 활용
 */

import fs from 'fs/promises';
import path from 'path';
import { DOCS_DIR } from '../../constants.js';

/**
 * 문서 메타데이터 인터페이스
 */
export interface DocumentMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  contentLength: number;
  filePath: string;
}

/**
 * 문서 데이터 인터페이스
 */
export interface Document {
  metadata: DocumentMetadata;
  content: string;
}

/**
 * 문서 요약 인터페이스 (목록 표시용)
 */
export interface DocumentSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  contentLength: number;
  preview?: string; // 첫 100자
}

/**
 * 문서 인덱스 인터페이스
 */
interface DocumentIndex {
  documents: DocumentMetadata[];
  version: string;
}

/**
 * Document Manager 클래스
 */
export class DocumentManager {
  private docsDir: string;
  private indexPath: string;

  constructor() {
    this.docsDir = DOCS_DIR;
    this.indexPath = path.join(this.docsDir, 'index.json');
  }

  /**
   * 문서 디렉토리 초기화
   */
  async ensureDocsDir(): Promise<void> {
    try {
      await fs.access(this.docsDir);
    } catch {
      await fs.mkdir(this.docsDir, { recursive: true });
    }
  }

  /**
   * 인덱스 파일 읽기
   */
  private async loadIndex(): Promise<DocumentIndex> {
    await this.ensureDocsDir();

    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(content) as DocumentIndex;
    } catch {
      // 인덱스 파일이 없으면 빈 인덱스 생성
      const emptyIndex: DocumentIndex = {
        documents: [],
        version: '1.0.0',
      };
      await this.saveIndex(emptyIndex);
      return emptyIndex;
    }
  }

  /**
   * 인덱스 파일 저장
   */
  private async saveIndex(index: DocumentIndex): Promise<void> {
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  /**
   * 문서 추가
   */
  async addDocument(title: string, content: string, tags: string[] = []): Promise<string> {
    await this.ensureDocsDir();

    // 문서 ID 생성
    const docId = 'doc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const fileName = docId + '.md';
    const filePath = path.join(this.docsDir, fileName);

    // 메타데이터 생성
    const metadata: DocumentMetadata = {
      id: docId,
      title: title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: tags,
      contentLength: content.length,
      filePath: fileName,
    };

    // 문서 파일 저장
    await fs.writeFile(filePath, content, 'utf-8');

    // 인덱스 업데이트
    const index = await this.loadIndex();
    index.documents.push(metadata);
    await this.saveIndex(index);

    return docId;
  }

  /**
   * 문서 조회
   */
  async getDocument(docId: string): Promise<Document | null> {
    await this.ensureDocsDir();

    const index = await this.loadIndex();
    const metadata = index.documents.find((doc) => doc.id === docId);

    if (!metadata) {
      return null;
    }

    try {
      const filePath = path.join(this.docsDir, metadata.filePath);
      const content = await fs.readFile(filePath, 'utf-8');

      return {
        metadata: metadata,
        content: content,
      };
    } catch {
      return null;
    }
  }

  /**
   * 모든 문서 목록 가져오기
   */
  async listDocuments(): Promise<DocumentSummary[]> {
    await this.ensureDocsDir();

    const index = await this.loadIndex();
    const summaries: DocumentSummary[] = [];

    for (const metadata of index.documents) {
      try {
        const filePath = path.join(this.docsDir, metadata.filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const preview = content.substring(0, 100).replace(/\n/g, ' ');

        summaries.push({
          id: metadata.id,
          title: metadata.title,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
          tags: metadata.tags,
          contentLength: metadata.contentLength,
          preview: preview,
        });
      } catch {
        // 파일을 읽을 수 없으면 preview 없이 추가
        summaries.push({
          id: metadata.id,
          title: metadata.title,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
          tags: metadata.tags,
          contentLength: metadata.contentLength,
        });
      }
    }

    // 최근 업데이트 순으로 정렬
    summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return summaries;
  }

  /**
   * 문서 검색 (제목, 내용, 태그)
   */
  async searchDocuments(query: string): Promise<DocumentSummary[]> {
    await this.ensureDocsDir();

    const allDocs = await this.listDocuments();
    const lowerQuery = query.toLowerCase();
    const results: DocumentSummary[] = [];

    for (const doc of allDocs) {
      // 제목 검색
      if (doc.title.toLowerCase().includes(lowerQuery)) {
        results.push(doc);
        continue;
      }

      // 태그 검색
      const hasMatchingTag = doc.tags.some((tag) => tag.toLowerCase().includes(lowerQuery));
      if (hasMatchingTag) {
        results.push(doc);
        continue;
      }

      // 내용 검색 (전체 파일 읽기)
      const fullDoc = await this.getDocument(doc.id);
      if (fullDoc && fullDoc.content.toLowerCase().includes(lowerQuery)) {
        results.push(doc);
      }
    }

    return results;
  }

  /**
   * 문서 업데이트
   */
  async updateDocument(
    docId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ): Promise<boolean> {
    await this.ensureDocsDir();

    const index = await this.loadIndex();
    const metadataIndex = index.documents.findIndex((doc) => doc.id === docId);

    if (metadataIndex === -1) {
      return false;
    }

    const metadata: DocumentMetadata = index.documents[metadataIndex]!;

    // 메타데이터 업데이트
    if (updates.title !== undefined) {
      metadata.title = updates.title;
    }
    if (updates.tags !== undefined) {
      metadata.tags = updates.tags;
    }
    metadata.updatedAt = new Date().toISOString();

    // 내용 업데이트
    if (updates.content !== undefined) {
      const filePath = path.join(this.docsDir, metadata.filePath);
      await fs.writeFile(filePath, updates.content, 'utf-8');
      metadata.contentLength = updates.content.length;
    }

    // 인덱스 저장
    index.documents[metadataIndex] = metadata;
    await this.saveIndex(index);

    return true;
  }

  /**
   * 문서 삭제
   */
  async deleteDocument(docId: string): Promise<boolean> {
    await this.ensureDocsDir();

    const index = await this.loadIndex();
    const metadataIndex = index.documents.findIndex((doc) => doc.id === docId);

    if (metadataIndex === -1) {
      return false;
    }

    const metadata: DocumentMetadata = index.documents[metadataIndex]!;
    const filePath = path.join(this.docsDir, metadata.filePath);

    // 파일 삭제
    try {
      await fs.unlink(filePath);
    } catch {
      // 파일이 없어도 인덱스에서는 제거
    }

    // 인덱스에서 제거
    index.documents.splice(metadataIndex, 1);
    await this.saveIndex(index);

    return true;
  }

  /**
   * 태그별 문서 조회
   */
  async getDocumentsByTag(tag: string): Promise<DocumentSummary[]> {
    await this.ensureDocsDir();

    const allDocs = await this.listDocuments();
    const lowerTag = tag.toLowerCase();

    return allDocs.filter((doc) => doc.tags.some((t) => t.toLowerCase() === lowerTag));
  }

  /**
   * 모든 태그 목록
   */
  async getAllTags(): Promise<string[]> {
    await this.ensureDocsDir();

    const index = await this.loadIndex();
    const tagsSet = new Set<string>();

    for (const doc of index.documents) {
      for (const tag of doc.tags) {
        tagsSet.add(tag);
      }
    }

    return Array.from(tagsSet).sort();
  }

  /**
   * 제목으로 문서 찾기
   */
  async findDocumentByTitle(title: string): Promise<DocumentSummary | null> {
    const docs = await this.listDocuments();
    return docs.find((doc) => doc.title === title) || null;
  }
}

/**
 * DocumentManager 싱글톤 인스턴스
 */
export const documentManager = new DocumentManager();
