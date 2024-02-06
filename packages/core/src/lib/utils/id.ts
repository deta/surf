import {v4 as uuidv4} from 'uuid';

export const generateID = () => {
  const random = Math.random().toString(36).substr(2, 10)
  return `${random}`
}

export const generateUUID = () => {
  return uuidv4();
}
