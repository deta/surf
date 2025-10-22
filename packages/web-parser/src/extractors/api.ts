export class APIExtractor {
  baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  async get(path: string, headers: any = {}) {
    const url = new URL(path, this.baseURL)
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    })

    return res
  }

  async getJSON(path: string, headers: any = {}) {
    const url = new URL(path, this.baseURL)
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    })

    if (!res.ok) {
      throw new Error('Failed to fetch data')
    }

    return res.json()
  }

  async postJSON(path: string, body: any, headers: any = {}) {
    const url = new URL(path, this.baseURL)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    })

    return res.json()
  }
}
