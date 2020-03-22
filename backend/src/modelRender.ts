import { UserDict, Interactions } from './model/model'
import { Node, Edge } from './rendering'

export function modelResultToGraphInput(risk: UserDict, interactions: Interactions) {
  const nodes: Node[] = []
  const nodesDict: { [id: number]: Node } = { }
  const edges: Edge[] = []

  for(const id in risk) {
    const node: Node = {
      id: `${id}`,
      risk: risk[id]
    }

    nodesDict[id] = node
    nodes.push(node)
  }

  for(const u1 in interactions) {
    for(const u2 in interactions[u1]) {
      const count = interactions[u1][u2]

      edges.push({
        from: nodesDict[u1],
        to: nodesDict[u2],
        count
      })
    }
  }

  return { nodes, edges }
}