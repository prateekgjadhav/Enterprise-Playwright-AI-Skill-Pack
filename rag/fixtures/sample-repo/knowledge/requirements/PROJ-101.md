---
id: PROJ-101
title: Checkout coupons
priority: P0
feature: checkout
status: in-progress
---
# Checkout coupons

Customers can apply a coupon code in the cart before paying.

- AC1: Applying a valid coupon code shows the discount row and reduces the cart total by the coupon amount.
- AC2: Removing the coupon restores the original cart total.
- AC3: An expired or invalid coupon code is rejected with an error message and the total does not change.
- AC4: At most 1 coupon can be applied per order.
- AC5: The discount appears quickly, within 2 seconds of submitting the code.
