import type { AdminMenuContext } from './admin-menus'
import { ownedAdminTransaction } from './admin-menus-runtime'
import { mutateAdminProduct, readProductsPage, type ProductMutation } from './admin-products'
import { scheduleTenantPublish } from '../site/publish-effects-runtime'

export const readOwnedProductsPage = (context: AdminMenuContext, selectedMenuId?: string) => ownedAdminTransaction(false, query => readProductsPage(query, context, selectedMenuId))
export const mutateOwnedProduct = async (context: AdminMenuContext, mutation: ProductMutation) => {
  const result = await ownedAdminTransaction(true, query => mutateAdminProduct(query, context, mutation))
  scheduleTenantPublish(context.tenantId)
  return result
}
