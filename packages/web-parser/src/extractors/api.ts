export class APIExtractor {
  baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  async get(path: string, headers: any = {}) {
    console.log('Requesting', path)

    const url = new URL(path, this.baseURL)
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    })

    console.log('Response', res)

    return res
  }

  async getJSON(path: string, headers: any = {}) {
    console.log('Requesting', path)

    const url = new URL(path, this.baseURL)
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    })

    console.log('Response', res)

    if (!res.ok) {
      throw new Error('Failed to fetch data')
    }

    return res.json()
  }

  async postJSON(path: string, body: any, headers: any = {}) {
    console.log('Requesting', path)

    const url = new URL(path, this.baseURL)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(body)
    })

    console.log('Response', res)

    return res.json()
  }
}
