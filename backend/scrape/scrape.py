import requests
from bs4 import BeautifulSoup
import json

document = requests.get("https://www.coronazaehler.de/").text
# yay fix broken encoding.
document = document.encode('latin-1').decode('utf-8')
soup = BeautifulSoup(document, "lxml")

cards = soup.findAll(("div", {"class": "card"}))

data = {}

for card in cards:
    header = card.find('h4')
    table = card.find('table')

    if header is None or table is None:
        continue

    state = header.getText()

    if state == "coronazaehler.de":
        state = 'Deutschland'

    rows = table.findAll("tr")

    regionData = {}
    
    for row in rows:
        cols = row.findAll("td")
        # ignore table header (th)
        if len(cols) >= 3:
            region = cols[0].getText()
            casesPerThousand = float(cols[1].getText()) / 100
            cases = float(cols[2].getText())
            regionData[region] = { "cases": cases, "casesPerThousand": casesPerThousand }

    data[state] = regionData

print(json.dumps(data, indent=1))