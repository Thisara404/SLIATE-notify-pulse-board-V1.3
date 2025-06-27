import { apiService } from './api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface Notice {
  id: number;
  title: string;
  description: string;
  imageUrl: string | null;
  files: Array<{
    name: string;
    url: string;
    size?: number;
    type?: string;
  }> | null;
  priority: 'low' | 'medium' | 'high';
  status: 'draft' | 'published';
  slug: string;
  createdBy: number;
  creatorName: string;
  creatorUsername: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
  uniqueViewers?: number;
}

export interface NoticeFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  search?: string;
  createdBy?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  includeStats?: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: {
    notices: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filters?: {
      status?: string;
      priority?: string;
      search?: string;
      createdBy?: number;
    };
  };
  timestamp: string;
}

class NoticeService {
  private getHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async getAllNotices(filters: NoticeFilters = {}): Promise<PaginatedResponse<Notice>> {
    // Build query params
    const queryParams = new URLSearchParams();
    if (filters.page) queryParams.append('page', filters.page.toString());
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.priority) queryParams.append('priority', filters.priority);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.createdBy) queryParams.append('createdBy', filters.createdBy.toString());
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
    if (filters.includeStats) queryParams.append('includeStats', 'true');

    // Add showOnlyOwnDrafts parameter
    queryParams.append('showOnlyOwnDrafts', 'true');

    const response = await fetch(`${API_BASE_URL}/notices?${queryParams.toString()}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch notices');
    }

    return await response.json();
  }

  async getNoticeById(id: string | number): Promise<{ success: boolean; data: { notice: Notice } }> {
    const response = await fetch(`${API_BASE_URL}/notices/${id}?includeStats=true`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to fetch notice with ID ${id}`);
    }

    return await response.json();
  }

  async createNotice(noticeData: FormData): Promise<{ success: boolean; data: { notice: Notice } }> {
    const response = await fetch(`${API_BASE_URL}/notices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: noticeData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create notice');
    }

    return await response.json();
  }

  async updateNotice(id: string | number, noticeData: FormData): Promise<{ success: boolean; data: { notice: Notice } }> {
    const response = await fetch(`${API_BASE_URL}/notices/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: noticeData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to update notice with ID ${id}`);
    }

    return await response.json();
  }

  async deleteNotice(id: string | number): Promise<{ success: boolean; data: { deletedNotice: { id: number; title: string } } }> {
    const response = await fetch(`${API_BASE_URL}/notices/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to delete notice with ID ${id}`);
    }

    return await response.json();
  }

  async publishNotice(id: string | number): Promise<{ success: boolean; data: { notice: Notice } }> {
    const response = await fetch(`${API_BASE_URL}/notices/${id}/publish`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to publish notice with ID ${id}`);
    }

    return await response.json();
  }

  async unpublishNotice(id: string | number): Promise<{ success: boolean; data: { notice: Notice } }> {
    const response = await fetch(`${API_BASE_URL}/notices/${id}/unpublish`, {
      method: 'POST',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to unpublish notice with ID ${id}`);
    }

    return await response.json();
  }

  async searchNotices(query: string, options: { page?: number; limit?: number; published_only?: boolean } = {}): 
    Promise<{ success: boolean; data: { notices: Notice[]; pagination: any; searchQuery: string } }> {
    const queryParams = new URLSearchParams({
      q: query,
      ...(options.page && { page: options.page.toString() }),
      ...(options.limit && { limit: options.limit.toString() }),
      ...(options.published_only !== undefined && { published_only: options.published_only.toString() })
    });

    const response = await fetch(`${API_BASE_URL}/notices/search?${queryParams}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Search failed');
    }

    return await response.json();
  }
}

export const noticeService = new NoticeService();