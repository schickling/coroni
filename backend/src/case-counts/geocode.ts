import axios from 'axios'

export default class GeoCode {
  private apiKey: string
  
  constructor(apiKey: string | undefined = process.env.GEOCODER_API_KEY) {
    if(!apiKey) {
      throw new Error("GEOCODER_API_KEY must be set.")
    }
    this.apiKey = apiKey
  }

  public async lookup(lat: number, lon: number): Promise<GeoCodeResult[]> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${this.apiKey}&language=de&region=DE`

    const response = await axios.get(url)
    const data = response.data

    if(data.status !== 'OK') {
      throw new Error(`API Error: ${JSON.stringify(data)}`)
    }

    return data.results
  }
}

export interface GeoCodeResult {
  formatted_address: string
  address_components: {
    long_name: string,
    short_name: string
    types: string[]
  }[]
}