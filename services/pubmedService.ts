
import { SearchResult, PubMedArticle } from '../types';

const PUBMED_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export const searchPubMed = async (query: string): Promise<SearchResult> => {
  const url = `${PUBMED_BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=20`;
  const response = await fetch(url);
  const data = await response.json();
  
  return {
    count: parseInt(data.esearchresult.count || "0", 10),
    ids: data.esearchresult.idlist || []
  };
};

export const fetchPubMedDetails = async (ids: string[]): Promise<PubMedArticle[]> => {
  if (ids.length === 0) return [];
  
  const url = `${PUBMED_BASE_URL}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
  const response = await fetch(url);
  const data = await response.json();
  
  // Esummary provides titles, but not full abstracts easily. 
  // For better quality, we'd use efetch, but esummary is faster for a demo.
  // We'll combine with efetch for abstracts if needed.
  
  const results: PubMedArticle[] = [];
  
  for (const id of ids) {
    const summary = data.result[id];
    if (summary) {
      results.push({
        id,
        title: summary.title,
        abstract: "Abstract summary fetching...", // Will refine with Gemini/fetch
        selected: false,
        publicationDate: summary.pubdate
      });
    }
  }
  
  // Secondary fetch for abstracts using efetch
  const fetchUrl = `${PUBMED_BASE_URL}/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`;
  const fetchResponse = await fetch(fetchUrl);
  const xmlText = await fetchResponse.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const articles = xmlDoc.getElementsByTagName("PubmedArticle");
  
  const finalResults: PubMedArticle[] = [];
  for(let i=0; i<articles.length; i++) {
    const pmid = articles[i].getElementsByTagName("PMID")[0]?.textContent || "";
    const title = articles[i].getElementsByTagName("ArticleTitle")[0]?.textContent || "";
    const abstractText = Array.from(articles[i].getElementsByTagName("AbstractText"))
      .map(node => node.textContent)
      .join(" ");
    
    finalResults.push({
      id: pmid,
      title: title,
      abstract: abstractText || "No abstract available.",
      selected: false,
      publicationDate: ""
    });
  }
  
  return finalResults;
};
