import api from './api';
import { SearchResult, SavedFilter } from '../types/Search';

export const searchService = {
  search: async (query: string): Promise<SearchResult> => {
    const response = await api.get<SearchResult>('/search', { params: { q: query } });
    return response.data;
  },

  getSavedFilters: async (): Promise<SavedFilter[]> => {
    const response = await api.get<SavedFilter[]>('/saved-filters');
    return response.data;
  },

  saveFilter: async (name: string, filterJson: string): Promise<SavedFilter> => {
    const response = await api.post<SavedFilter>('/saved-filters', { name, filterJson });
    return response.data;
  },

  deleteFilter: async (id: number): Promise<void> => {
    await api.delete(`/saved-filters/${id}`);
  },
};
