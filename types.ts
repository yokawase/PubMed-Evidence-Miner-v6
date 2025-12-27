
export interface MeshTerm {
  id: string;
  term: string;
  selected: boolean;
}

export interface PubMedArticle {
  id: string;
  title: string;
  abstract: string;
  translatedTitle?: string;
  translatedAbstract?: string;
  relevanceAnalysis?: string;
  selected: boolean;
  publicationDate?: string;
}

export interface SearchResult {
  count: number;
  ids: string[];
}

export enum AppStep {
  INPUT = 0,
  MESH_SELECTION = 1,
  PAPER_SELECTION = 2,
  FINAL_SYNTHESIS = 3
}
