import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { AdminLoginBody, AuthUser, CreateOrderBody, CreateProductBody, CreateReviewBody, DashboardSummary, ErrorResponse, HealthStatus, ListAdminOrdersParams, ListAdminReviewsParams, ListProductsParams, LoginBody, Order, Product, RequestUploadUrlBody, RequestUploadUrlResponse, Review, SessionInfo, SignupBody, UpdateOrderStatusBody, UpdateProductBody, UpdateReviewStatusBody } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a customer account
 */
export declare const getSignupUrl: () => string;
export declare const signup: (signupBody: SignupBody, options?: RequestInit) => Promise<AuthUser>;
export declare const getSignupMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof signup>>, TError, {
        data: BodyType<SignupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof signup>>, TError, {
    data: BodyType<SignupBody>;
}, TContext>;
export type SignupMutationResult = NonNullable<Awaited<ReturnType<typeof signup>>>;
export type SignupMutationBody = BodyType<SignupBody>;
export type SignupMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Create a customer account
 */
export declare const useSignup: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof signup>>, TError, {
        data: BodyType<SignupBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof signup>>, TError, {
    data: BodyType<SignupBody>;
}, TContext>;
/**
 * @summary Log in as a customer
 */
export declare const getLoginUrl: () => string;
export declare const login: (loginBody: LoginBody, options?: RequestInit) => Promise<AuthUser>;
export declare const getLoginMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginBody>;
}, TContext>;
export type LoginMutationResult = NonNullable<Awaited<ReturnType<typeof login>>>;
export type LoginMutationBody = BodyType<LoginBody>;
export type LoginMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Log in as a customer
 */
export declare const useLogin: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginBody>;
}, TContext>;
/**
 * @summary Log out
 */
export declare const getLogoutUrl: () => string;
export declare const logout: (options?: RequestInit) => Promise<void>;
export declare const getLogoutMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
export type LogoutMutationResult = NonNullable<Awaited<ReturnType<typeof logout>>>;
export type LogoutMutationError = ErrorType<unknown>;
/**
 * @summary Log out
 */
export declare const useLogout: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
/**
 * @summary Get current authenticated session
 */
export declare const getGetCurrentUserUrl: () => string;
export declare const getCurrentUser: (options?: RequestInit) => Promise<SessionInfo>;
export declare const getGetCurrentUserQueryKey: () => readonly ["/api/auth/me"];
export declare const getGetCurrentUserQueryOptions: <TData = Awaited<ReturnType<typeof getCurrentUser>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCurrentUser>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCurrentUser>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCurrentUserQueryResult = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
export type GetCurrentUserQueryError = ErrorType<unknown>;
/**
 * @summary Get current authenticated session
 */
export declare function useGetCurrentUser<TData = Awaited<ReturnType<typeof getCurrentUser>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCurrentUser>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Log in to the admin dashboard
 */
export declare const getAdminLoginUrl: () => string;
export declare const adminLogin: (adminLoginBody: AdminLoginBody, options?: RequestInit) => Promise<void>;
export declare const getAdminLoginMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminLogin>>, TError, {
        data: BodyType<AdminLoginBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof adminLogin>>, TError, {
    data: BodyType<AdminLoginBody>;
}, TContext>;
export type AdminLoginMutationResult = NonNullable<Awaited<ReturnType<typeof adminLogin>>>;
export type AdminLoginMutationBody = BodyType<AdminLoginBody>;
export type AdminLoginMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Log in to the admin dashboard
 */
export declare const useAdminLogin: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminLogin>>, TError, {
        data: BodyType<AdminLoginBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof adminLogin>>, TError, {
    data: BodyType<AdminLoginBody>;
}, TContext>;
/**
 * @summary Log out of the admin dashboard
 */
export declare const getAdminLogoutUrl: () => string;
export declare const adminLogout: (options?: RequestInit) => Promise<void>;
export declare const getAdminLogoutMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminLogout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof adminLogout>>, TError, void, TContext>;
export type AdminLogoutMutationResult = NonNullable<Awaited<ReturnType<typeof adminLogout>>>;
export type AdminLogoutMutationError = ErrorType<unknown>;
/**
 * @summary Log out of the admin dashboard
 */
export declare const useAdminLogout: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof adminLogout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof adminLogout>>, TError, void, TContext>;
/**
 * @summary Request a presigned upload URL for an object
 */
export declare const getRequestUploadUrlUrl: () => string;
export declare const requestUploadUrl: (requestUploadUrlBody: RequestUploadUrlBody, options?: RequestInit) => Promise<RequestUploadUrlResponse>;
export declare const getRequestUploadUrlMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
        data: BodyType<RequestUploadUrlBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
    data: BodyType<RequestUploadUrlBody>;
}, TContext>;
export type RequestUploadUrlMutationResult = NonNullable<Awaited<ReturnType<typeof requestUploadUrl>>>;
export type RequestUploadUrlMutationBody = BodyType<RequestUploadUrlBody>;
export type RequestUploadUrlMutationError = ErrorType<unknown>;
/**
 * @summary Request a presigned upload URL for an object
 */
export declare const useRequestUploadUrl: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
        data: BodyType<RequestUploadUrlBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
    data: BodyType<RequestUploadUrlBody>;
}, TContext>;
/**
 * @summary List products
 */
export declare const getListProductsUrl: (params?: ListProductsParams) => string;
export declare const listProducts: (params?: ListProductsParams, options?: RequestInit) => Promise<Product[]>;
export declare const getListProductsQueryKey: (params?: ListProductsParams) => readonly ["/api/products", ...ListProductsParams[]];
export declare const getListProductsQueryOptions: <TData = Awaited<ReturnType<typeof listProducts>>, TError = ErrorType<unknown>>(params?: ListProductsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProducts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listProducts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListProductsQueryResult = NonNullable<Awaited<ReturnType<typeof listProducts>>>;
export type ListProductsQueryError = ErrorType<unknown>;
/**
 * @summary List products
 */
export declare function useListProducts<TData = Awaited<ReturnType<typeof listProducts>>, TError = ErrorType<unknown>>(params?: ListProductsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProducts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Featured products
 */
export declare const getListFeaturedProductsUrl: () => string;
export declare const listFeaturedProducts: (options?: RequestInit) => Promise<Product[]>;
export declare const getListFeaturedProductsQueryKey: () => readonly ["/api/products/featured"];
export declare const getListFeaturedProductsQueryOptions: <TData = Awaited<ReturnType<typeof listFeaturedProducts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFeaturedProducts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listFeaturedProducts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListFeaturedProductsQueryResult = NonNullable<Awaited<ReturnType<typeof listFeaturedProducts>>>;
export type ListFeaturedProductsQueryError = ErrorType<unknown>;
/**
 * @summary Featured products
 */
export declare function useListFeaturedProducts<TData = Awaited<ReturnType<typeof listFeaturedProducts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFeaturedProducts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Newest arrivals
 */
export declare const getListNewArrivalsUrl: () => string;
export declare const listNewArrivals: (options?: RequestInit) => Promise<Product[]>;
export declare const getListNewArrivalsQueryKey: () => readonly ["/api/products/new-arrivals"];
export declare const getListNewArrivalsQueryOptions: <TData = Awaited<ReturnType<typeof listNewArrivals>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listNewArrivals>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listNewArrivals>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListNewArrivalsQueryResult = NonNullable<Awaited<ReturnType<typeof listNewArrivals>>>;
export type ListNewArrivalsQueryError = ErrorType<unknown>;
/**
 * @summary Newest arrivals
 */
export declare function useListNewArrivals<TData = Awaited<ReturnType<typeof listNewArrivals>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listNewArrivals>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get product detail
 */
export declare const getGetProductUrl: (id: string) => string;
export declare const getProduct: (id: string, options?: RequestInit) => Promise<Product>;
export declare const getGetProductQueryKey: (id: string) => readonly [`/api/products/${string}`];
export declare const getGetProductQueryOptions: <TData = Awaited<ReturnType<typeof getProduct>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetProductQueryResult = NonNullable<Awaited<ReturnType<typeof getProduct>>>;
export type GetProductQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get product detail
 */
export declare function useGetProduct<TData = Awaited<ReturnType<typeof getProduct>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProduct>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List approved reviews for a product
 */
export declare const getListProductReviewsUrl: (id: string) => string;
export declare const listProductReviews: (id: string, options?: RequestInit) => Promise<Review[]>;
export declare const getListProductReviewsQueryKey: (id: string) => readonly [`/api/products/${string}/reviews`];
export declare const getListProductReviewsQueryOptions: <TData = Awaited<ReturnType<typeof listProductReviews>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProductReviews>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listProductReviews>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListProductReviewsQueryResult = NonNullable<Awaited<ReturnType<typeof listProductReviews>>>;
export type ListProductReviewsQueryError = ErrorType<unknown>;
/**
 * @summary List approved reviews for a product
 */
export declare function useListProductReviews<TData = Awaited<ReturnType<typeof listProductReviews>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listProductReviews>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Submit a review for a product
 */
export declare const getCreateProductReviewUrl: (id: string) => string;
export declare const createProductReview: (id: string, createReviewBody: CreateReviewBody, options?: RequestInit) => Promise<Review>;
export declare const getCreateProductReviewMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProductReview>>, TError, {
        id: string;
        data: BodyType<CreateReviewBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createProductReview>>, TError, {
    id: string;
    data: BodyType<CreateReviewBody>;
}, TContext>;
export type CreateProductReviewMutationResult = NonNullable<Awaited<ReturnType<typeof createProductReview>>>;
export type CreateProductReviewMutationBody = BodyType<CreateReviewBody>;
export type CreateProductReviewMutationError = ErrorType<unknown>;
/**
 * @summary Submit a review for a product
 */
export declare const useCreateProductReview: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProductReview>>, TError, {
        id: string;
        data: BodyType<CreateReviewBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createProductReview>>, TError, {
    id: string;
    data: BodyType<CreateReviewBody>;
}, TContext>;
/**
 * @summary Place an order
 */
export declare const getCreateOrderUrl: () => string;
export declare const createOrder: (createOrderBody: CreateOrderBody, options?: RequestInit) => Promise<Order>;
export declare const getCreateOrderMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError, {
        data: BodyType<CreateOrderBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError, {
    data: BodyType<CreateOrderBody>;
}, TContext>;
export type CreateOrderMutationResult = NonNullable<Awaited<ReturnType<typeof createOrder>>>;
export type CreateOrderMutationBody = BodyType<CreateOrderBody>;
export type CreateOrderMutationError = ErrorType<unknown>;
/**
 * @summary Place an order
 */
export declare const useCreateOrder: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError, {
        data: BodyType<CreateOrderBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createOrder>>, TError, {
    data: BodyType<CreateOrderBody>;
}, TContext>;
/**
 * @summary Get order details (for confirmation page)
 */
export declare const getGetOrderUrl: (id: string) => string;
export declare const getOrder: (id: string, options?: RequestInit) => Promise<Order>;
export declare const getGetOrderQueryKey: (id: string) => readonly [`/api/orders/${string}`];
export declare const getGetOrderQueryOptions: <TData = Awaited<ReturnType<typeof getOrder>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOrderQueryResult = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
export type GetOrderQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get order details (for confirmation page)
 */
export declare function useGetOrder<TData = Awaited<ReturnType<typeof getOrder>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Admin dashboard summary
 */
export declare const getGetAdminDashboardUrl: () => string;
export declare const getAdminDashboard: (options?: RequestInit) => Promise<DashboardSummary>;
export declare const getGetAdminDashboardQueryKey: () => readonly ["/api/admin/dashboard"];
export declare const getGetAdminDashboardQueryOptions: <TData = Awaited<ReturnType<typeof getAdminDashboard>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAdminDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAdminDashboard>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAdminDashboardQueryResult = NonNullable<Awaited<ReturnType<typeof getAdminDashboard>>>;
export type GetAdminDashboardQueryError = ErrorType<unknown>;
/**
 * @summary Admin dashboard summary
 */
export declare function useGetAdminDashboard<TData = Awaited<ReturnType<typeof getAdminDashboard>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAdminDashboard>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a product
 */
export declare const getCreateProductUrl: () => string;
export declare const createProduct: (createProductBody: CreateProductBody, options?: RequestInit) => Promise<Product>;
export declare const getCreateProductMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProduct>>, TError, {
        data: BodyType<CreateProductBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createProduct>>, TError, {
    data: BodyType<CreateProductBody>;
}, TContext>;
export type CreateProductMutationResult = NonNullable<Awaited<ReturnType<typeof createProduct>>>;
export type CreateProductMutationBody = BodyType<CreateProductBody>;
export type CreateProductMutationError = ErrorType<unknown>;
/**
 * @summary Create a product
 */
export declare const useCreateProduct: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createProduct>>, TError, {
        data: BodyType<CreateProductBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createProduct>>, TError, {
    data: BodyType<CreateProductBody>;
}, TContext>;
/**
 * @summary Update a product
 */
export declare const getUpdateProductUrl: (id: string) => string;
export declare const updateProduct: (id: string, updateProductBody: UpdateProductBody, options?: RequestInit) => Promise<Product>;
export declare const getUpdateProductMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProduct>>, TError, {
        id: string;
        data: BodyType<UpdateProductBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateProduct>>, TError, {
    id: string;
    data: BodyType<UpdateProductBody>;
}, TContext>;
export type UpdateProductMutationResult = NonNullable<Awaited<ReturnType<typeof updateProduct>>>;
export type UpdateProductMutationBody = BodyType<UpdateProductBody>;
export type UpdateProductMutationError = ErrorType<unknown>;
/**
 * @summary Update a product
 */
export declare const useUpdateProduct: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateProduct>>, TError, {
        id: string;
        data: BodyType<UpdateProductBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateProduct>>, TError, {
    id: string;
    data: BodyType<UpdateProductBody>;
}, TContext>;
/**
 * @summary Delete a product
 */
export declare const getDeleteProductUrl: (id: string) => string;
export declare const deleteProduct: (id: string, options?: RequestInit) => Promise<void>;
export declare const getDeleteProductMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteProduct>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteProduct>>, TError, {
    id: string;
}, TContext>;
export type DeleteProductMutationResult = NonNullable<Awaited<ReturnType<typeof deleteProduct>>>;
export type DeleteProductMutationError = ErrorType<unknown>;
/**
 * @summary Delete a product
 */
export declare const useDeleteProduct: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteProduct>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteProduct>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary List all orders
 */
export declare const getListAdminOrdersUrl: (params?: ListAdminOrdersParams) => string;
export declare const listAdminOrders: (params?: ListAdminOrdersParams, options?: RequestInit) => Promise<Order[]>;
export declare const getListAdminOrdersQueryKey: (params?: ListAdminOrdersParams) => readonly ["/api/admin/orders", ...ListAdminOrdersParams[]];
export declare const getListAdminOrdersQueryOptions: <TData = Awaited<ReturnType<typeof listAdminOrders>>, TError = ErrorType<unknown>>(params?: ListAdminOrdersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAdminOrders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAdminOrders>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAdminOrdersQueryResult = NonNullable<Awaited<ReturnType<typeof listAdminOrders>>>;
export type ListAdminOrdersQueryError = ErrorType<unknown>;
/**
 * @summary List all orders
 */
export declare function useListAdminOrders<TData = Awaited<ReturnType<typeof listAdminOrders>>, TError = ErrorType<unknown>>(params?: ListAdminOrdersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAdminOrders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update order status
 */
export declare const getUpdateOrderStatusUrl: (id: string) => string;
export declare const updateOrderStatus: (id: string, updateOrderStatusBody: UpdateOrderStatusBody, options?: RequestInit) => Promise<Order>;
export declare const getUpdateOrderStatusMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
        id: string;
        data: BodyType<UpdateOrderStatusBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
    id: string;
    data: BodyType<UpdateOrderStatusBody>;
}, TContext>;
export type UpdateOrderStatusMutationResult = NonNullable<Awaited<ReturnType<typeof updateOrderStatus>>>;
export type UpdateOrderStatusMutationBody = BodyType<UpdateOrderStatusBody>;
export type UpdateOrderStatusMutationError = ErrorType<unknown>;
/**
 * @summary Update order status
 */
export declare const useUpdateOrderStatus: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
        id: string;
        data: BodyType<UpdateOrderStatusBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
    id: string;
    data: BodyType<UpdateOrderStatusBody>;
}, TContext>;
/**
 * @summary List all reviews
 */
export declare const getListAdminReviewsUrl: (params?: ListAdminReviewsParams) => string;
export declare const listAdminReviews: (params?: ListAdminReviewsParams, options?: RequestInit) => Promise<Review[]>;
export declare const getListAdminReviewsQueryKey: (params?: ListAdminReviewsParams) => readonly ["/api/admin/reviews", ...ListAdminReviewsParams[]];
export declare const getListAdminReviewsQueryOptions: <TData = Awaited<ReturnType<typeof listAdminReviews>>, TError = ErrorType<unknown>>(params?: ListAdminReviewsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAdminReviews>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAdminReviews>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAdminReviewsQueryResult = NonNullable<Awaited<ReturnType<typeof listAdminReviews>>>;
export type ListAdminReviewsQueryError = ErrorType<unknown>;
/**
 * @summary List all reviews
 */
export declare function useListAdminReviews<TData = Awaited<ReturnType<typeof listAdminReviews>>, TError = ErrorType<unknown>>(params?: ListAdminReviewsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAdminReviews>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update review status (approve/hide)
 */
export declare const getUpdateReviewStatusUrl: (id: string) => string;
export declare const updateReviewStatus: (id: string, updateReviewStatusBody: UpdateReviewStatusBody, options?: RequestInit) => Promise<Review>;
export declare const getUpdateReviewStatusMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateReviewStatus>>, TError, {
        id: string;
        data: BodyType<UpdateReviewStatusBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateReviewStatus>>, TError, {
    id: string;
    data: BodyType<UpdateReviewStatusBody>;
}, TContext>;
export type UpdateReviewStatusMutationResult = NonNullable<Awaited<ReturnType<typeof updateReviewStatus>>>;
export type UpdateReviewStatusMutationBody = BodyType<UpdateReviewStatusBody>;
export type UpdateReviewStatusMutationError = ErrorType<unknown>;
/**
 * @summary Update review status (approve/hide)
 */
export declare const useUpdateReviewStatus: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateReviewStatus>>, TError, {
        id: string;
        data: BodyType<UpdateReviewStatusBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateReviewStatus>>, TError, {
    id: string;
    data: BodyType<UpdateReviewStatusBody>;
}, TContext>;
/**
 * @summary Delete a review
 */
export declare const getDeleteReviewUrl: (id: string) => string;
export declare const deleteReview: (id: string, options?: RequestInit) => Promise<void>;
export declare const getDeleteReviewMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteReview>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteReview>>, TError, {
    id: string;
}, TContext>;
export type DeleteReviewMutationResult = NonNullable<Awaited<ReturnType<typeof deleteReview>>>;
export type DeleteReviewMutationError = ErrorType<unknown>;
/**
 * @summary Delete a review
 */
export declare const useDeleteReview: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteReview>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteReview>>, TError, {
    id: string;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map