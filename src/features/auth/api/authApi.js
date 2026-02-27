import { http } from '../../../shared/services/http';

export const registerAdmin = async (payload) => {
  const response = await http.post('/auth/register', payload);
  return response.data;
};

export const loginAdmin = async (payload) => {
  const response = await http.post('/auth/login', payload);
  return response.data;
};

