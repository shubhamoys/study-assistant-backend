import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class HealthStatus {
  // Definite assignment (`!`) — this class is a GraphQL output shape, always
  // populated via an object literal (see health.resolver.ts), never `new`'d.
  @Field()
  status!: string;

  @Field()
  timestamp!: string;

  @Field()
  database!: string;
}
