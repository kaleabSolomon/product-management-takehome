import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { Product, ProductStatus } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ChapaService } from 'chapa-nestjs';
import { ConfigService } from '@nestjs/config';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private chapa: ChapaService,
    private config: ConfigService,
  ) {}

  async createOrder(
    dto: CreateOrderDto,
    userId: string,
  ): Promise<{ checkoutUrl: string; txRef: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    const product = await this.productRepository.findOne({
      where: { id: dto.productId },
    });

    if (!product) {
      this.logger.warn('Product not found for order', {
        productId: dto.productId,
        userId,
      });
      throw new NotFoundException('Product not found');
    }

    if (product.status === ProductStatus.DELETED) {
      this.logger.warn('Attempted to order deleted product', {
        productId: dto.productId,
        userId,
      });
      throw new BadRequestException('Product is no longer available');
    }

    if (product.status !== ProductStatus.ACTIVE) {
      this.logger.warn('Attempted to order non-active product', {
        productId: dto.productId,
        status: product.status,
        userId,
      });
      throw new BadRequestException(
        `Product is not available for purchase (status: ${product.status})`,
      );
    }

    if (product.stock < dto.quantity) {
      this.logger.warn('Insufficient stock for order', {
        productId: dto.productId,
        requestedQuantity: dto.quantity,
        availableStock: product.stock,
        userId,
      });
      throw new BadRequestException(
        `Insufficient stock. Available: ${product.stock}, Requested: ${dto.quantity}`,
      );
    }

    const totalPrice = Number(product.price) * dto.quantity;

    // Generate transaction reference
    const txRef = await this.chapa.generateTransactionReference({ size: 20 });

    const order = this.orderRepository.create({
      userId,
      productId: dto.productId,
      quantity: dto.quantity,
      totalPrice,
      txRef,
      status: OrderStatus.PENDING,
    });

    let savedOrder: Order;
    try {
      savedOrder = await this.orderRepository.save(order);
    } catch (error) {
      this.logger.error('Failed to create order', {
        userId,
        productId: dto.productId,
        error,
      });
      throw new InternalServerErrorException('Failed to create order');
    }

    this.logger.info('Order created successfully', {
      orderId: savedOrder.id,
      userId,
      productId: dto.productId,
      quantity: dto.quantity,
      totalPrice,
    });

    let response: any;
    try {
      response = await this.chapa.initialize({
        first_name: user.firstName,
        last_name: user.lastName,
        email: 'kaleabslmn@gmail.com',
        currency: 'ETB',
        amount: totalPrice.toString(),
        tx_ref: txRef,
        callback_url: `${this.config.get('CALLBACK_URL')}/orders/verify`,
        customization: {
          title: `product order`,
          description: `Purchase of ${dto.quantity} ${product.title}`,
        },
      });

      if (!response || !response.data?.checkout_url) {
        throw new BadRequestException('Could not process payment.');
      }

      return {
        checkoutUrl: response.data.checkout_url,
        txRef,
      };
    } catch (error) {
      // Mark order as failed if payment initialization fails
      await this.orderRepository.update(
        { id: savedOrder.id },
        { status: OrderStatus.FAILED },
      );
      console.log(error);
      this.logger.error('Failed to initialize payment', {
        orderId: savedOrder.id,
        error,
      });

      throw new InternalServerErrorException('Could not process payment');
    }
  }

  async verifyPayment(txRef: string): Promise<Order> {
    const response = await this.chapa.verify({ tx_ref: txRef });

    if (response.status !== 'success' || response.data.status !== 'success') {
      this.logger.warn('Payment verification failed', { txRef });
      throw new BadRequestException('Payment verification failed');
    }

    const order = await this.orderRepository.findOne({
      where: { txRef: response.data.tx_ref },
      relations: ['product', 'user'],
    });

    if (!order) {
      this.logger.warn('Order not found for txRef', { txRef });
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      this.logger.info('Order already processed', {
        txRef,
        currentStatus: order.status,
      });
      return order;
    }

    order.status = OrderStatus.SUCCESSFUL;

    const product = order.product;
    if (product.stock >= order.quantity) {
      product.stock -= order.quantity;
      if (product.stock === 0) {
        product.status = ProductStatus.OUT_OF_STOCK;
      }

      try {
        await this.productRepository.save(product);
        await this.orderRepository.save(order);

        this.logger.info('Order verified and completed successfully', {
          orderId: order.id,
          txRef,
          productId: product.id,
          newStock: product.stock,
        });

        return order;
      } catch (error) {
        this.logger.error('Failed to update order and product', {
          orderId: order.id,
          error,
        });
        throw new InternalServerErrorException(
          'Failed to complete order verification',
        );
      }
    } else {
      order.status = OrderStatus.FAILED;
      await this.orderRepository.save(order);

      this.logger.warn('Insufficient stock during verification', {
        orderId: order.id,
        txRef,
        requiredStock: order.quantity,
        availableStock: product.stock,
      });

      throw new BadRequestException(
        'Insufficient stock to complete order. Payment will be refunded.',
      );
    }
  }

  async getMyOrders(userId: string, status?: OrderStatus): Promise<Order[]> {
    const whereCondition: any = { userId };
    if (status) {
      whereCondition.status = status;
    }

    return await this.orderRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      relations: ['product', 'user'],
    });
  }

  async getOrderById(orderId: string, userId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['product', 'user'],
    });

    if (!order) {
      this.logger.warn('Order not found', { orderId });
      throw new NotFoundException('Order not found');
    }

    // Check if user is either the buyer or the product owner
    if (order.userId !== userId && order.product.userId !== userId) {
      this.logger.warn('User not authorized to access order', {
        orderId,
        userId,
        orderUserId: order.userId,
        productOwnerId: order.product.userId,
      });
      throw new ForbiddenException('You do not have access to this order');
    }

    return order;
  }

  async getOrdersForMyProducts(
    userId: string,
    status?: OrderStatus,
  ): Promise<Order[]> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.product', 'product')
      .leftJoinAndSelect('order.user', 'user')
      .where('product.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');

    return await queryBuilder.getMany();
  }

  async updateOrderStatus(
    orderId: string,
    userId: string,
    dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['product'],
    });

    if (!order) {
      this.logger.warn('Order not found for status update', { orderId });
      throw new NotFoundException('Order not found');
    }

    // Only product owner can update order status
    if (order.product.userId !== userId) {
      this.logger.warn('User not authorized to update order status', {
        orderId,
        userId,
        productOwnerId: order.product.userId,
      });
      throw new ForbiddenException(
        'Only the product owner can update order status',
      );
    }

    const oldStatus = order.status;
    order.status = dto.status;

    if (
      dto.status === OrderStatus.FAILED &&
      oldStatus === OrderStatus.SUCCESSFUL
    ) {
      const product = await this.productRepository.findOne({
        where: { id: order.productId },
      });

      if (product) {
        product.stock += order.quantity;
        if (
          product.stock > 0 &&
          product.status === ProductStatus.OUT_OF_STOCK
        ) {
          product.status = ProductStatus.ACTIVE;
        }
        await this.productRepository.save(product);
      }
    }

    let updatedOrder: Order;
    try {
      updatedOrder = await this.orderRepository.save(order);
    } catch (error) {
      this.logger.error('Failed to update order status', {
        orderId,
        userId,
        error,
      });
      throw new InternalServerErrorException('Failed to update order status');
    }

    this.logger.info('Order status updated successfully', {
      orderId,
      userId,
      oldStatus,
      newStatus: dto.status,
    });

    return updatedOrder;
  }
}
