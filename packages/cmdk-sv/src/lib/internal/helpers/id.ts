import { nanoid } from 'nanoid/non-secure';

export function generateId() {
	return nanoid(10);
}
