type ProductSizeTemplateAssignment = {
  label: string
  sideMode: string
  frontTemplateId?: string | null
  backTemplateId?: string | null
  designConfigurations?: unknown
}

import { designConfigurationsForSize } from './design-configurations'

type TemplateRole = { id: string; templateSide: string }

export function validateTemplateSideAssignments(sizes: ProductSizeTemplateAssignment[], templates: TemplateRole[]) {
  const byId = new Map(templates.map((template) => [template.id, template]))
  for (const size of sizes) {
    for (const configuration of designConfigurationsForSize(size).filter((row) => row.enabled)) {
      if (configuration.designType === 'single_side' && configuration.singleTemplateId) {
        const single = byId.get(configuration.singleTemplateId)
        if (!single) throw new Error(`${size.label} references a template that no longer exists.`)
        if (single.templateSide !== 'single') throw new Error(`${size.label} needs a single template for its single-sided design.`)
      }
      if (configuration.designType === 'double_side' && configuration.frontTemplateId) {
        const front = byId.get(configuration.frontTemplateId)
        if (!front) throw new Error(`${size.label} references a template that no longer exists.`)
        if (front.templateSide !== 'front') throw new Error(`${size.label} needs a front template for its double-sided design.`)
      }
      if (configuration.designType === 'double_side' && configuration.backTemplateId) {
        const back = byId.get(configuration.backTemplateId)
        if (!back || back.templateSide !== 'back') throw new Error(`${size.label} needs a template marked as back.`)
      }
    }
  }
}
