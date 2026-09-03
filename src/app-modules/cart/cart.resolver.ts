import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CartItemType } from './dto/cart-item.type';
import { CartItem } from './entities/cart-item.entity';
import { CartService } from './cart.service';

@Resolver()
export class CartResolver {
  constructor(private readonly cartService: CartService) {}

  @Query(() => [CartItemType])
  myCart(@CurrentUser() user: User): Promise<CartItem[]> {
    return this.cartService.findForUser(user.id);
  }

  @Mutation(() => CartItemType)
  addDeckToCart(
    @CurrentUser() user: User,
    @Args('deckId', { type: () => ID }) deckId: string,
  ): Promise<CartItem> {
    return this.cartService.addDeck(user.id, deckId);
  }

  @Mutation(() => Boolean)
  removeDeckFromCart(
    @CurrentUser() user: User,
    @Args('deckId', { type: () => ID }) deckId: string,
  ): Promise<boolean> {
    return this.cartService.removeDeck(user.id, deckId);
  }
}
