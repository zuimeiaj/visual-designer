
const API_BASE = '/api/projects';

export interface CloudProject {
  id: string;
  name: string;
  updatedAt: string;
  data?: any;
}

export const apiService = {
  async getProjects(): Promise<CloudProject[]> {
    const res = await fetch(API_BASE);
    return res.json();
  },

  async getProject(id: string): Promise<CloudProject> {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) throw new Error('Failed to fetch project');
    return res.json();
  },

  async saveProject(id: string | null, name: string, data: any): Promise<CloudProject> {
    const method = id ? 'PATCH' : 'POST';
    const url = id ? `${API_BASE}/${id}` : API_BASE;
    const body = id ? { data } : { name, data };

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) throw new Error('Failed to save project');
    return res.json();
  },

  async deleteProject(id: string): Promise<void> {
    await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
  }
};
